-- ============ 07: προσυμφωνίες, νέα τιμολόγηση, έσοδα ============
alter table offers drop constraint if exists offers_status_check;
alter table offers add constraint offers_status_check check (status in ('open','agreed','accepted','rejected','cancelled','expired','invalid'));

-- Συμφωνία: με ανοιχτή μεταγραφική ολοκληρώνεται αμέσως, αλλιώς γίνεται προσυμφωνία
-- και ολοκληρώνεται αυτόματα με το άνοιγμα της επόμενης περιόδου.
create or replace function efel_close_deal(o offers) returns void
language plpgsql security definer set search_path=public as $$
begin
  if (cfg('window_open') #>> '{}')::boolean then perform efel_execute_offer(o); return; end if;
  if not exists (select 1 from roster where player_id = o.player_id and club_id = o.to_club) then
    raise exception 'Ο παίκτης δεν ανήκει πια στον σύλλογο.'; end if;
  update offers set status = 'agreed', decided_at = now() where id = o.id;
  update offers set status = 'invalid', decided_at = now(), note = 'Ο παίκτης έχει ήδη προσυμφωνήσει με άλλο σύλλογο.'
   where player_id = o.player_id and status = 'open' and id <> o.id;
  perform efel_news('agreed', jsonb_build_object('player', o.player_id, 'from', o.to_club, 'to', o.from_club, 'gp', o.gp, 'swap', o.swap_player));
end $$;

create or replace function efel_execute_agreed() returns int
language plpgsql security definer set search_path=public as $$
declare o offers; k int := 0;
begin
  for o in select * from offers where status = 'agreed' order by decided_at loop
    begin perform efel_execute_offer(o); k := k + 1;
    exception when others then
      update offers set status = 'invalid', decided_at = now(), note = 'Η προσυμφωνία δεν ολοκληρώθηκε: ' || sqlerrm where id = o.id;
    end;
  end loop;
  return k;
end $$;
revoke all on function efel_close_deal(offers), efel_execute_agreed() from public, anon, authenticated;

-- τα GP μιας προσυμφωνίας μένουν δεσμευμένα ως την ολοκλήρωση
create or replace function efel_finance(c int) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare bud bigint; n int; bids_sum bigint := 0; offers_sum bigint := 0; reserve bigint;
begin
  select budget into bud from clubs where id = c;
  select count(*) into n from roster where club_id = c;
  if c = efel_my_club() or efel_is_admin() then
    select coalesce(sum(b.amount),0) into bids_sum from bids b join bid_rounds r on r.id=b.round_id
      where b.club_id = c and r.status = 'open';
  end if;
  select coalesce(sum(gp),0) into offers_sum from offers where from_club = c and status in ('open','agreed');
  reserve := greatest(0, (cfg_int('max_roster') - n) * cfg_int('min_price'));
  return jsonb_build_object('budget', bud, 'in_bids', bids_sum, 'in_offers', offers_sum,
    'reserve', reserve, 'free', bud - bids_sum - offers_sum - reserve, 'roster', n);
end $$;

-- Τιμή από το OVR (όχι από τη σειρά κατάταξης): ίδιο OVR, ίδια τιμή, χωρίς «γκρεμό» στο 76-77.
create or replace function efel_price_of(o int) returns int language sql immutable as $$
  select case
    when o >= 85 then least(180000, 130000 + (o-85)*15000)
    else (array[5000,6000,7000,8500,10000,12000,18000,25000,35000,47000,60000,72000,86000,100000,115000])[greatest(o,70)-69]
  end $$;
create or replace function efel_reprice() returns void
language plpgsql security definer set search_path=public as $$
begin
  update players set price = greatest(cfg_int('min_price'), efel_price_of(ovr)) where price is distinct from greatest(cfg_int('min_price'), efel_price_of(ovr));
end $$;

create or replace function efel_respond_offer(p_offer int, p_accept boolean, p_terms boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); o offers;
begin
  select * into o from offers where id = p_offer for update;
  if not found or o.status <> 'open' then raise exception 'Η πρόταση δεν είναι πια ανοιχτή.'; end if;
  if c not in (o.to_club, o.from_club) then raise exception 'Η πρόταση δεν σε αφορά.'; end if;
  if not p_accept then
    update offers set status = case when c = o.from_club then 'cancelled' else 'rejected' end, decided_at = now() where id = p_offer;
    perform efel_log('offer_rejected', jsonb_build_object('offer', p_offer));
    return;
  end if;
  if coalesce(o.turn, o.to_club) <> c then raise exception 'Περιμένεις απάντηση από τον άλλο σύλλογο.'; end if;
  if not p_terms then raise exception 'Αποδέξου τους όρους: η μεταγραφή είναι οριστική.'; end if;
  perform efel_close_deal(o);
  perform efel_log('offer_accepted', jsonb_build_object('offer', p_offer, 'rule', cfg('rule_version')));
end $$;

create or replace function efel_npc_negotiate() returns int
language plpgsql security definer set search_path=public as $$
declare o offers; r record; ask int; offered int; first_gp int; maxpay int; k int := 0; e text; nm text; mid int;
begin
  for o in select of.* from offers of join clubs c on c.id = coalesce(of.turn, of.to_club)
            where of.status = 'open' and c.is_auto loop
    nm := (select name from clubs where id = coalesce(o.turn, o.to_club));
    if coalesce(o.turn, o.to_club) = o.to_club then
      -- ο αυτόματος πουλάει: θέλει ≥ 115% του κόστους του (ή της τιμής, ό,τι είναι μεγαλύτερο)
      select ro.paid, p.price into r from roster ro join players p on p.id = ro.player_id where ro.player_id = o.player_id;
      ask := (ceil(greatest(r.paid, r.price) * 1.15 / 1000) * 1000)::int;
      offered := o.gp + coalesce((select price from players where id = o.swap_player), 0);
      if offered >= ask then
        begin perform efel_close_deal(o); k := k + 1;
        exception when others then
          update offers set status='rejected', decided_at=now(), note = format('Η %s δεν μπορεί να ολοκληρώσει: %s', nm, sqlerrm) where id=o.id;
        end;
      elsif offered >= ask * 0.75 and o.round < cfg_int('counter_rounds') then
        perform efel_counter_internal(o, o.to_club, greatest(o.gp, ask - coalesce((select price from players where id = o.swap_player), 0)), o.swap_player,
          format('Η %s ζητά %s GP%s.', nm, efel_fmt(ask), case when o.swap_player is not null then ' συνολικά (μαζί με την ανταλλαγή)' else '' end));
        k := k + 1;
      else
        update offers set status='rejected', decided_at=now(),
          note = format('Η %s δεν πουλάει κάτω από %s GP.', nm, efel_fmt(ask)) where id=o.id;
      end if;
    else
      -- ο αυτόματος αγοράζει και του έκαναν αντιπρόταση
      first_gp := coalesce((o.history->0->>'gp')::int, o.gp);
      maxpay := (ceil(first_gp * (1 + cfg_int('npc_max_raise_pct') / 100.0) / 1000) * 1000)::int;
      perform efel_auto_make_room(o.from_club, o.player_id, o.swap_player);
      e := efel_check_add(o.from_club, o.player_id, o.gp, o.swap_player);
      if o.gp <= maxpay and e = '' then
        begin perform efel_close_deal(o); k := k + 1;
        exception when others then
          update offers set status='rejected', decided_at=now(), note = format('Η %s δεν μπορεί να ολοκληρώσει: %s', nm, sqlerrm) where id=o.id;
        end;
      elsif o.round < cfg_int('counter_rounds') and e = '' then
        mid := (ceil((coalesce((o.history->-2->>'gp')::int, first_gp) + least(o.gp, maxpay)) / 2000.0) * 1000)::int;
        mid := least(mid, maxpay);
        perform efel_counter_internal(o, o.from_club, mid, o.swap_player, format('Η %s ανεβαίνει ως %s GP.', nm, efel_fmt(mid)));
        k := k + 1;
      else
        update offers set status='rejected', decided_at=now(),
          note = format('Η %s δεν πάει πάνω από %s GP.', nm, efel_fmt(maxpay)) where id=o.id;
      end if;
    end if;
  end loop;
  return k;
end $$;

create or replace function efel_auto_market() returns int
language plpgsql security definer set search_path=public as $$
declare o offers; a record; r record; sw bigint; need text; have int; tgt int; g int; k int := 0; reason text;
begin
  -- 1. απαντήσεις και αντιπροτάσεις των αυτόματων (efel_npc_negotiate)
  k := k + efel_npc_negotiate();
  -- 2. ενδιαφέρον: κάθε αυτόματος σύλλογος με κενό σε θέση κάνει το πολύ 1 πρόταση/μέρα
  for a in select * from clubs where is_auto loop
    continue when exists (select 1 from offers where from_club = a.id and created_at > now() - interval '1 day');
    select x.key, (select count(*) from roster rr join players p on p.id=rr.player_id where rr.club_id=a.id and grp(p.pos)=x.key)
      into need, have
      from jsonb_each_text('{"GK":2,"DEF":8,"MID":8,"FWD":7}'::jsonb) x
     order by x.value::int - (select count(*) from roster rr join players p on p.id=rr.player_id where rr.club_id=a.id and grp(p.pos)=x.key) desc, random()
     limit 1;
    continue when random() > 0.35;
    select rr.*, p.price, p.ovr into r from roster rr join players p on p.id = rr.player_id join clubs c on c.id = rr.club_id
     where grp(p.pos) = need and rr.club_id <> a.id and rr.activation = 'active'
       and not exists (select 1 from offers x where x.player_id = rr.player_id and x.status in ('open','agreed'))
       and p.ovr > (select coalesce(min(p2.ovr),0) from roster r2 join players p2 on p2.id=r2.player_id where r2.club_id=a.id and grp(p2.pos)=need)
     order by random() limit 1;
    continue when r.player_id is null;
    g := (ceil(greatest(r.paid, r.price) * (1.05 + random()*0.3) / 1000) * 1000)::int;
    sw := null;
    if efel_check_add(a.id, r.player_id, g) <> '' then
      select r2.player_id into sw from roster r2 join players p2 on p2.id = r2.player_id
       where r2.club_id = a.id and grp(p2.pos) = need order by p2.ovr asc limit 1;
      continue when sw is null;
      g := greatest(0, g - (select price from players where id = sw));
      continue when efel_check_add(a.id, r.player_id, g, sw) <> '';
    end if;
    reason := format('Η %s θέλει να αναβαθμίσει τους %s: ο πιο αδύναμος της έχει OVR %s, ο παίκτης σου %s.', a.name,
              case need when 'GK' then 'τερματοφύλακες' when 'DEF' then 'αμυντικούς' when 'MID' then 'μέσους' else 'επιθετικούς' end,
              (select min(p2.ovr) from roster r2 join players p2 on p2.id=r2.player_id where r2.club_id=a.id and grp(p2.pos)=need), r.ovr);
    insert into offers(from_club, to_club, player_id, gp, swap_player, expires_at, note, turn, history)
    values (a.id, r.club_id, r.player_id, g, sw, now() + make_interval(hours => cfg_int('offer_hours')::int), reason, r.club_id,
            jsonb_build_array(jsonb_build_object('by', a.id, 'gp', g, 'swap', sw, 'ts', now())));
    k := k + 1;
  end loop;
  return k;
end $$;

create or replace function efel_tick() returns jsonb
language plpgsql security definer set search_path=public as $$
declare m record; hs numeric; as_ numeric; n_sim int := 0; n_exp int; n_lock int; n_round int := 0; n_mkt int; n_win int;
begin
  n_win := efel_window_sync();
  if (cfg('window_open') #>> '{}')::boolean then perform efel_execute_agreed(); end if;
  for m in select mt.* from matches mt join leagues l on l.id = mt.league_id
            where l.kind = 'auto' and mt.status = 'open' and mt.season_no = cfg_int('season_no')
              and efel_md_date(mt.md) <= current_date and (cfg('phase') #>> '{}') = 'season'
            order by mt.md loop
    hs := efel_strength(m.home); as_ := efel_strength(m.away);
    perform efel_finalize(m.id, efel_poisson(greatest(0.3, 1.45 + (hs-as_)/8)), efel_poisson(greatest(0.3, 1.15 - (hs-as_)/8)), true);
    n_sim := n_sim + 1;
  end loop;
  update offers set status = 'expired', decided_at = now() where status = 'open' and expires_at < now();
  get diagnostics n_exp = row_count;
  update roster set activation = 'locked'
   where activation in ('pending','unable') and activation_deadline < now();
  get diagnostics n_lock = row_count;
  if exists (select 1 from bid_rounds where status='open' and closes_at < now()) then
    n_round := efel_close_round_internal();
  end if;
  n_mkt := efel_auto_market();
  return jsonb_build_object('simulated', n_sim, 'expired', n_exp, 'locked', n_lock, 'round_won', n_round,
                            'market', n_mkt, 'window', n_win);
end $$;

-- προτάσεις όλη τη σεζόν· η ολοκλήρωση περιμένει τη μεταγραφική
create or replace function efel_make_offer(p_player bigint, p_gp int, p_swap bigint default null) returns int
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); owner int; e text; oid int;
begin
  if (cfg('phase') #>> '{}') <> 'season' then raise exception 'Οι προτάσεις ανοίγουν όταν ξεκινήσει η σεζόν.'; end if;
  if exists (select 1 from offers where status='agreed' and player_id=p_player) then
    raise exception 'Ο παίκτης έχει ήδη προσυμφωνήσει με άλλο σύλλογο.'; end if;
  select club_id into owner from roster where player_id = p_player;
  if owner is null then raise exception 'Ο παίκτης είναι ελεύθερος: αγόρασέ τον από την αγορά.'; end if;
  if owner = c then raise exception 'Ο παίκτης είναι ήδη δικός σου.'; end if;
  if p_gp < 0 or (p_gp = 0 and p_swap is null) then raise exception 'Βάλε GP ή παίκτη σε ανταλλαγή.'; end if;
  if p_swap is not null and not exists (select 1 from roster where player_id = p_swap and club_id = c) then
    raise exception 'Ο παίκτης της ανταλλαγής δεν είναι δικός σου.'; end if;
  if exists (select 1 from offers where status='open' and from_club=c and player_id=p_player) then
    raise exception 'Έχεις ήδη ανοιχτή πρόταση για αυτόν τον παίκτη.'; end if;
  if (efel_finance(c)->>'budget')::bigint - (efel_finance(c)->>'in_offers')::bigint < p_gp then
    raise exception 'Δεν σου φτάνουν τα GP (μετράνε και οι άλλες ανοιχτές προτάσεις σου).'; end if;
  e := efel_check_add(c, p_player, p_gp, p_swap); if e <> '' then raise exception '%', e; end if;
  insert into offers(from_club, to_club, player_id, gp, swap_player, expires_at, turn, history)
  values (c, owner, p_player, p_gp, p_swap, now() + make_interval(hours => cfg_int('offer_hours')::int), owner,
          jsonb_build_array(jsonb_build_object('by', c, 'gp', p_gp, 'swap', p_swap, 'ts', now())))
  returning id into oid;
  perform efel_log('offer', jsonb_build_object('offer', oid, 'player', p_player, 'gp', p_gp, 'swap', p_swap));
  return oid;
end $$;

select efel_reprice();
update config set value='6000' where key='win_bonus';
update config set value='2000' where key='draw_bonus';
