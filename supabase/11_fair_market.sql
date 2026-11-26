-- 11 · 26/11/2026 · δίκαιη αγορά, ελάχιστο ρόστερ, απόθεμα ως τους 18, κατακύρωση χωρίς manager,
-- προθεσμία σκορ, διόρθωση συμμετοχών φιλικών. Μετά από δοκιμαστική σεζόν (playtest 26/11).
-- Όλα τα νούμερα είναι ρυθμίσεις στον πίνακα config.

insert into config(key, value) values
  ('reserve_to',        '18'),                                   -- απόθεμα 5.000 ανά κενή θέση ως εδώ
  ('min_zone',          '{"GK":2,"DEF":5,"MID":5,"FWD":3}'),     -- ελάχιστο ρόστερ ανθρώπινου συλλόγου ανά ζώνη
  ('npc_pay_pct',       '120'),                                  -- ο αυτόματος πληρώνει έως 120% της τιμής
  ('npc_cooldown_days', '21'),                                   -- όχι προτάσεις για παίκτη που απέκτησες πριν από λιγότερο από 21 μέρες
  ('npc_offers_week',   '2'),                                    -- έως 2 προτάσεις αυτόματων ανά ανθρώπινο σύλλογο ανά 7 μέρες
  ('forfeit_days',      '3'),                                    -- σύλλογος χωρίς manager: κατακύρωση 3 μέρες μετά
  ('report_days',       '4'),                                    -- προθεσμία δήλωσης σκορ (εκπρόθεσμος στη σελίδα)
  ('forfeit_mode',      '"sim"')                                -- sim: προσομοίωση από τα ρόστερ · walkover: 3-0
on conflict (key) do nothing;

alter table matches add column if not exists decided text;      -- 'forfeit' όταν κατακυρώθηκε χωρίς αγώνα

-- ---------- Διόρθωση: συμμετοχές φιλικών (cfg_int επιστρέφει bigint) ----------
create or replace function efel_trg_friendly_apps() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.status = 'final' and old.status is distinct from 'final' then
    begin
      perform efel_snapshot_apps(null, new.id, cfg_int('season_no')::int, array[new.home, new.away], 'friendly');
    exception when others then raise warning 'appearances: %', sqlerrm;
    end;
  elsif old.status = 'final' and new.status <> 'final' then
    delete from appearances where friendly_id = new.id;
  end if;
  return new;
end $$;

-- ---------- Απόθεμα ως τους reserve_to ----------
create or replace function efel_reserve_to() returns int language sql stable set search_path=public as $$
  select coalesce(cfg_int('reserve_to'), cfg_int('squad_target'), 18)::int $$;
revoke execute on function efel_reserve_to() from public, anon, authenticated;

create or replace function efel_check_add(c int, pid bigint, cost bigint, minus bigint default null)
returns text language plpgsql stable security definer set search_path=public as $$
declare n int; ng int; g text; q int; bud bigint; maxr int := cfg_int('max_roster'); minp int := cfg_int('min_price'); rt int := efel_reserve_to();
begin
  select grp(pos) into g from players where id = pid;
  select count(*) into n from roster where club_id = c and player_id is distinct from minus;
  select count(*) into ng from roster r join players p on p.id = r.player_id
    where r.club_id = c and grp(p.pos) = g and r.player_id is distinct from minus;
  q := (cfg('quota') ->> g)::int;
  select budget into bud from clubs where id = c;
  if n >= maxr then return 'Το ρόστερ είναι γεμάτο.'; end if;
  if ng >= q then return format('Έφτασες το όριο θέσης (%s: %s).', g, q); end if;
  if bud - cost < greatest(0, rt - n - 1) * minp then
    return format('Πρέπει να μείνουν %s GP για να φτάσεις τους %s παίκτες (%s GP για κάθε κενή θέση).',
                  efel_fmt(greatest(0, rt - n - 1) * minp), rt, efel_fmt(minp));
  end if;
  return '';
end $$;

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
  reserve := greatest(0, (efel_reserve_to() - n) * cfg_int('min_price'));
  return jsonb_build_object('budget', bud, 'in_bids', bids_sum, 'in_offers', offers_sum,
    'reserve', reserve, 'reserve_to', efel_reserve_to(), 'free', bud - bids_sum - offers_sum - reserve, 'roster', n);
end $$;

-- ---------- Ελάχιστο ρόστερ ανθρώπινου συλλόγου ----------
-- Μετρά το ρόστερ όπως θα είναι μετά την κίνηση: βγαίνουν p_out, μπαίνουν p_in, και ήδη οι προσυμφωνίες.
-- '' = εντάξει, αλλιώς εξήγηση. Οι αυτόματοι σύλλογοι δεν ελέγχονται.
create or replace function efel_min_check(c int, p_out bigint[], p_in bigint[] default '{}', p_skip_offer int default null)
returns text language plpgsql stable security definer set search_path=public as $$
declare mz jsonb := cfg('min_zone'); z text; need int; have int; outs bigint[]; ins bigint[];
begin
  if coalesce((select is_auto from clubs where id = c), true) or mz is null then return ''; end if;
  select coalesce(array_agg(player_id), '{}') into outs from offers
   where status = 'agreed' and to_club = c and id is distinct from p_skip_offer;
  outs := outs || coalesce((select array_agg(swap_player) from offers where status='agreed' and from_club=c and swap_player is not null and id is distinct from p_skip_offer), '{}') || coalesce(p_out,'{}');
  select coalesce(array_agg(player_id), '{}') into ins from offers
   where status = 'agreed' and from_club = c and id is distinct from p_skip_offer;
  ins := ins || coalesce((select array_agg(swap_player) from offers where status='agreed' and to_club=c and swap_player is not null and id is distinct from p_skip_offer), '{}') || coalesce(p_in,'{}');
  for z, need in select key, value::int from jsonb_each_text(mz) loop
    select count(*) into have from (
      select r.player_id from roster r join players p on p.id = r.player_id
       where r.club_id = c and grp(p.pos) = z and not (r.player_id = any(outs))
      union
      select p.id from players p where p.id = any(ins) and grp(p.pos) = z
    ) t;
    if have < need then
      return format('Ο σύλλογος πρέπει να κρατά τουλάχιστον %s %s (θα έμεναν %s).', need,
        case z when 'GK' then 'τερματοφύλακες' when 'DEF' then 'αμυντικούς' when 'MID' then 'μέσους' else 'επιθετικούς' end, have);
    end if;
  end loop;
  return '';
end $$;
revoke execute on function efel_min_check(int, bigint[], bigint[], int) from public, anon, authenticated;

create or replace function efel_release(p_player bigint) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); r roster; refund int; e text;
begin
  perform efel_lock_clubs(array[c]);
  select * into r from roster where player_id = p_player and club_id = c for update;
  if not found then raise exception 'Ο παίκτης δεν είναι στο ρόστερ σου.'; end if;
  if not (cfg('window_open') #>> '{}')::boolean then raise exception 'Η μεταγραφική περίοδος είναι κλειστή.'; end if;
  e := efel_min_check(c, array[p_player]); if e <> '' then raise exception '%', e; end if;
  refund := (r.paid / 2000) * 1000;
  delete from roster where player_id = p_player;
  update offers set status='invalid', decided_at=now() where status='open' and (player_id=p_player or swap_player=p_player);
  update clubs set budget = budget + refund where id = c;
  perform efel_news('release', jsonb_build_object('club', c, 'player', p_player, 'refund', refund));
  perform efel_log('release', jsonb_build_object('player', p_player, 'refund', refund));
end $$;

-- έλεγχος ελάχιστου ρόστερ και για τους δύο συλλόγους μιας πρότασης
create or replace function efel_offer_min_check(o offers) returns text
language plpgsql stable security definer set search_path=public as $$
declare e text;
begin
  e := efel_min_check(o.to_club, array[o.player_id], case when o.swap_player is null then '{}'::bigint[] else array[o.swap_player] end, o.id);
  if e <> '' then return (select name from clubs where id = o.to_club) || ': ' || e; end if;
  if o.swap_player is not null then
    e := efel_min_check(o.from_club, array[o.swap_player], array[o.player_id], o.id);
    if e <> '' then return (select name from clubs where id = o.from_club) || ': ' || e; end if;
  end if;
  return '';
end $$;
revoke execute on function efel_offer_min_check(offers) from public, anon, authenticated;

create or replace function efel_close_deal(o offers) returns void
language plpgsql security definer set search_path=public as $$
declare e text;
begin
  e := efel_offer_min_check(o); if e <> '' then raise exception '%', e; end if;
  if (cfg('window_open') #>> '{}')::boolean then perform efel_execute_offer(o); return; end if;
  if not exists (select 1 from roster where player_id = o.player_id and club_id = o.to_club) then
    raise exception 'Ο παίκτης δεν ανήκει πια στον σύλλογο.'; end if;
  update offers set status = 'agreed', decided_at = now() where id = o.id;
  update offers set status = 'invalid', decided_at = now(), note = 'Ο παίκτης έχει ήδη προσυμφωνήσει με άλλο σύλλογο.'
   where player_id = o.player_id and status = 'open' and id <> o.id;
  perform efel_news('agreed', jsonb_build_object('player', o.player_id, 'from', o.to_club, 'to', o.from_club, 'gp', o.gp, 'swap', o.swap_player));
end $$;
revoke all on function efel_close_deal(offers) from public, anon, authenticated;

create or replace function efel_execute_offer(o offers) returns void
language plpgsql security definer set search_path=public as $$
declare rmv roster; rsw roster; e text; fb bigint;
begin
  perform efel_lock_clubs(array[o.from_club, o.to_club]);
  select * into rmv from roster where player_id = o.player_id and club_id = o.to_club for update;
  if not found then raise exception 'Ο παίκτης δεν ανήκει πια στον σύλλογο.'; end if;
  if o.swap_player is not null then
    select * into rsw from roster where player_id = o.swap_player and club_id = o.from_club for update;
    if not found then raise exception 'Ο παίκτης της ανταλλαγής δεν ανήκει πια στον αγοραστή.'; end if;
  end if;
  e := efel_offer_min_check(o); if e <> '' then raise exception '%', e; end if;
  select budget into fb from clubs where id = o.from_club for update;
  if fb < o.gp then raise exception 'Ο αγοραστής δεν έχει πια αρκετά GP.'; end if;
  perform efel_auto_make_room(o.from_club, o.player_id, o.swap_player);
  e := efel_check_add(o.from_club, o.player_id, o.gp, o.swap_player);
  if e <> '' then raise exception 'Ο αγοραστής (%) δεν μπορεί να ολοκληρώσει: %', (select name from clubs where id=o.from_club), e; end if;
  delete from roster where player_id = o.player_id;
  if o.swap_player is not null then delete from roster where player_id = o.swap_player; end if;
  perform efel_acquire(o.from_club, o.player_id, greatest(o.gp, 0), case when o.swap_player is null then 'transfer' else 'swap' end);
  if o.swap_player is not null then perform efel_acquire(o.to_club, o.swap_player, rsw.paid, 'swap'); end if;
  update clubs set budget = budget - o.gp where id = o.from_club;
  update clubs set budget = budget + o.gp where id = o.to_club;
  update offers set status = 'accepted', decided_at = now() where id = o.id;
  update offers set status = 'invalid', decided_at = now()
   where status = 'open' and id <> o.id and (player_id in (o.player_id, coalesce(o.swap_player,-1))
                                           or swap_player in (o.player_id, coalesce(o.swap_player,-1)));
  perform efel_news('transfer', jsonb_build_object('player', o.player_id, 'from', o.to_club, 'to', o.from_club, 'gp', o.gp, 'swap', o.swap_player));
end $$;
revoke all on function efel_execute_offer(offers) from public, anon, authenticated;

-- ---------- Αυτόματοι: δίκαιες τιμές, όριο προτάσεων, χωρίς κερδοσκοπία ----------
create or replace function efel_npc_negotiate() returns int
language plpgsql security definer set search_path=public as $$
declare o offers; r record; ask int; offered int; first_gp int; maxpay int; k int := 0; e text; nm text; mid int; pr int;
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
      -- ο αυτόματος αγοράζει: ταβάνι = μικρότερο από (+30% της πρώτης του πρότασης) και (npc_pay_pct της τιμής)
      select price into pr from players where id = o.player_id;
      first_gp := coalesce((o.history->0->>'gp')::int, o.gp);
      maxpay := greatest(first_gp, least(
        (ceil(first_gp * (1 + cfg_int('npc_max_raise_pct') / 100.0) / 1000) * 1000)::int,
        (floor(pr * coalesce(cfg_int('npc_pay_pct'), 120) / 100.0 / 1000) * 1000)::int));
      perform efel_auto_make_room(o.from_club, o.player_id, o.swap_player);
      e := efel_check_add(o.from_club, o.player_id, o.gp, o.swap_player);
      if o.gp <= maxpay and e = '' then
        begin perform efel_close_deal(o); k := k + 1;
        exception when others then
          update offers set status='rejected', decided_at=now(), note = format('Η %s δεν μπορεί να ολοκληρώσει: %s', nm, sqlerrm) where id=o.id;
        end;
      elsif o.round < cfg_int('counter_rounds') and e = '' and maxpay > coalesce((o.history->-2->>'gp')::int, first_gp) then
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
revoke all on function efel_npc_negotiate() from public, anon, authenticated;

create or replace function efel_auto_market() returns int
language plpgsql security definer set search_path=public as $$
declare a record; r record; sw bigint; need text; have int; g int; k int := 0; reason text;
        cool int := coalesce(cfg_int('npc_cooldown_days'), 21); wk int := coalesce(cfg_int('npc_offers_week'), 2);
begin
  -- 1. απαντήσεις και αντιπροτάσεις των αυτόματων
  k := k + efel_npc_negotiate();
  -- 2. νέο ενδιαφέρον μόνο μέσα στη σεζόν
  if (cfg('phase') #>> '{}') <> 'season' then return k; end if;
  for a in select * from clubs where is_auto loop
    continue when exists (select 1 from offers where from_club = a.id and created_at > now() - interval '1 day');
    select x.key, (select count(*) from roster rr join players p on p.id=rr.player_id where rr.club_id=a.id and grp(p.pos)=x.key)
      into need, have
      from jsonb_each_text('{"GK":2,"DEF":8,"MID":8,"FWD":7}'::jsonb) x
     order by x.value::int - (select count(*) from roster rr join players p on p.id=rr.player_id where rr.club_id=a.id and grp(p.pos)=x.key) desc, random()
     limit 1;
    continue when random() > 0.35;
    select rr.*, p.price, p.ovr, c.is_auto owner_auto into r
      from roster rr join players p on p.id = rr.player_id join clubs c on c.id = rr.club_id
     where grp(p.pos) = need and rr.club_id <> a.id and rr.activation = 'active'
       and not exists (select 1 from offers x where x.player_id = rr.player_id and x.status in ('open','agreed'))
       and p.ovr > (select coalesce(min(p2.ovr),0) from roster r2 join players p2 on p2.id=r2.player_id where r2.club_id=a.id and grp(p2.pos)=need)
       and (c.is_auto or (
             rr.acquired_at < now() - make_interval(days => cool)
         and (select count(*) from offers x join clubs xa on xa.id = x.from_club
               where xa.is_auto and x.to_club = rr.club_id and x.created_at > now() - interval '7 days') < wk
         and efel_min_check(rr.club_id, array[rr.player_id]) = ''))
     order by random() limit 1;
    continue when r.player_id is null;
    -- τιμή: από την αξία του παίκτη (όχι από όσα πλήρωσε ο κάτοχος), 100-110%
    g := (ceil(r.price * (1.0 + random()*0.1) / 1000) * 1000)::int;
    if r.owner_auto then g := greatest(g, (ceil(r.paid * 1.15 / 1000) * 1000)::int); end if;
    sw := null;
    if efel_check_add(a.id, r.player_id, g) <> '' then
      select r2.player_id into sw from roster r2 join players p2 on p2.id = r2.player_id
       where r2.club_id = a.id and grp(p2.pos) = need order by p2.ovr asc limit 1;
      continue when sw is null;
      g := greatest(0, g - (select price from players where id = sw));
      continue when efel_check_add(a.id, r.player_id, g, sw) <> '';
      continue when not r.owner_auto and efel_min_check(r.club_id, array[r.player_id], array[sw]) <> '';
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
revoke all on function efel_auto_market() from public, anon, authenticated;

-- ---------- Σύλλογος χωρίς manager: κατακύρωση ----------
create or replace function efel_forfeits() returns int
language plpgsql security definer set search_path=public as $$
declare m record; hh boolean; ah boolean; k int := 0; hg int; ag int; fd int := coalesce(cfg_int('forfeit_days'), 3);
begin
  if (cfg('phase') #>> '{}') <> 'season' then return 0; end if;
  for m in select mt.* from matches mt join leagues l on l.id = mt.league_id
            where l.kind = 'human' and mt.season_no = cfg_int('season_no') and mt.status in ('open','reported','disputed')
              and efel_md_date(mt.md) + fd < current_date loop
    hh := efel_human_club(m.home); ah := efel_human_club(m.away);
    continue when hh and ah;
    if m.status = 'reported' and efel_human_club(m.reported_by) then
      hg := m.hg; ag := m.ag;                         -- το σκορ που δήλωσε ο σύλλογος με manager
    elsif coalesce(cfg('forfeit_mode') #>> '{}', 'sim') = 'sim' then
      hg := efel_poisson(greatest(0.3, 1.45 + (efel_strength(m.home)-efel_strength(m.away))/8));
      ag := efel_poisson(greatest(0.3, 1.15 - (efel_strength(m.home)-efel_strength(m.away))/8));
    elsif hh then hg := 3; ag := 0;
    elsif ah then hg := 0; ag := 3;
    else hg := 0; ag := 0; end if;
    perform efel_finalize(m.id, hg, ag);
    update matches set decided = case when coalesce(cfg('forfeit_mode') #>> '{}', 'sim') = 'sim' and not (m.status = 'reported' and efel_human_club(m.reported_by)) then 'sim' else 'forfeit' end where id = m.id;
    perform efel_news('note', jsonb_build_object('text', format('%sη αγωνιστική: %s - %s %s-%s. ' || case when coalesce(cfg('forfeit_mode') #>> '{}', 'sim') = 'sim' and not (m.status = 'reported' and efel_human_club(m.reported_by)) then 'Προσομοίωση από τα ρόστερ' else 'Κατακύρωση' end || ', γιατί %s δεν είχε manager %s μέρες μετά την ημερομηνία του αγώνα.',
      m.md, (select name from clubs where id = m.home), (select name from clubs where id = m.away), hg, ag,
      case when not hh and not ah then 'κανένας σύλλογος' when not hh then 'η ' || (select name from clubs where id = m.home) else 'η ' || (select name from clubs where id = m.away) end, fd)), m.league_id);
    k := k + 1;
  end loop;
  return k;
end $$;
revoke all on function efel_forfeits() from public, anon, authenticated;

create or replace function efel_tick() returns jsonb
language plpgsql security definer set search_path=public as $$
declare m record; hs numeric; as_ numeric; n_sim int := 0; n_exp int; n_lock int; n_round int := 0; n_mkt int; n_win int; n_ff int;
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
  n_ff := efel_forfeits();
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
                            'market', n_mkt, 'window', n_win, 'forfeits', n_ff);
end $$;
revoke all on function efel_tick() from public, anon, authenticated;

-- ---------- Συγχρονισμός με τη ζωντανή βάση (ίδια λογική, τώρα και στο repo) ----------
create or replace function efel_end_manager(p_club int, p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare me int := efel_my_club();
begin
  if (efel_is_admin() or me = p_club) is not true then raise exception 'Δεν επιτρέπεται.'; end if;
  update club_managers set ended_at = now(), end_reason = left(coalesce(p_reason,''),200)
   where club_id = p_club and ended_at is null;
  update clubs set status = 'seeking_manager' where id = p_club;
  update offers set status = 'cancelled', decided_at = now(), note = 'Αλλαγή manager'
   where status = 'open' and from_club = p_club;
  perform efel_news('manager', jsonb_build_object('club', p_club, 'event', 'left'));
  perform efel_log('end_manager', jsonb_build_object('club', p_club));
end $$;

update config set value = '"2026-11-26"' where key = 'rule_version';

-- ---------- Νέα: οι κινήσεις ανάμεσα σε αυτόματους δεν πνίγουν τα νέα των managers ----------
alter table news add column if not exists scope text not null default 'league';
create or replace function efel_news_scope() returns trigger
language plpgsql security definer set search_path=public as $$
declare ids int[];
begin
  if new.type in ('transfer','agreed','buy','release','renew','contract_end','result','friendly') then
    select coalesce(array_agg(v::int), '{}') into ids from (
      select new.payload->>k v from unnest(array['club','from','to','home','away']) k) t where v ~ '^[0-9]+$';
    if coalesce(array_length(ids,1),0) > 0 and not exists (select 1 from clubs where id = any(ids) and not is_auto) then
      new.scope := 'world';
    end if;
  end if;
  return new;
end $$;
revoke all on function efel_news_scope() from public, anon, authenticated;
drop trigger if exists news_scope on news;
create trigger news_scope before insert on news for each row execute function efel_news_scope();
update news n set scope = 'world'
 where n.type in ('transfer','agreed','buy','release','renew','contract_end','result','friendly')
   and not exists (select 1 from clubs c where not c.is_auto and c.id::text in
       (n.payload->>'club', n.payload->>'from', n.payload->>'to', n.payload->>'home', n.payload->>'away'))
   and exists (select 1 from clubs c where c.id::text in
       (n.payload->>'club', n.payload->>'from', n.payload->>'to', n.payload->>'home', n.payload->>'away'));
create index if not exists news_scope_ts on news(scope, ts desc);
