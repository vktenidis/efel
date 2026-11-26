-- =====================================================================
-- EFEL · 06 · Αντιπροτάσεις, ραντεβού με εναλλακτικές, συμβόλαια,
--        αυτόματη μεταγραφική περίοδος, προφίλ managers (26/11/2026)
-- =====================================================================

-- ---------- Στήλες ----------
alter table offers   add column if not exists turn int;           -- ποιος σύλλογος πρέπει να απαντήσει
alter table offers   add column if not exists round int not null default 1;
alter table offers   add column if not exists history jsonb not null default '[]';
update offers set turn = to_club where turn is null;
alter table matches  add column if not exists time_slots jsonb;   -- εναλλακτικές ώρες της τελευταίας πρότασης
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists efootball_name text;
alter table profiles add column if not exists platform text;      -- console / mobile
alter table profiles add column if not exists contact text;       -- Discord / Viber / Messenger

-- ---------- Νέες ρυθμίσεις (προεπιλογές για έγκριση) ----------
insert into config(key, value) values
  ('contract_seasons', '2'),        -- διάρκεια νέου συμβολαίου σε σεζόν
  ('renew_pct', '30'),              -- κόστος ανανέωσης ανά σεζόν: % της τρέχουσας τιμής
  ('counter_rounds', '4'),          -- μέγιστοι γύροι διαπραγμάτευσης
  ('window_auto', 'true'),          -- η μεταγραφική ανοίγει/κλείνει μόνη της
  ('window_mid_after_md', '9'),     -- η μεσοπερίοδος ανοίγει μετά από αυτή την αγωνιστική
  ('window_days', '7'),             -- διάρκεια κάθε παραθύρου σε μέρες
  ('npc_max_raise_pct', '30')       -- πόσο πάνω από την αρχική του πρόταση πάει ένας αυτόματος
on conflict (key) do nothing;

-- ---------- Προφίλ ----------
create or replace function efel_on_signup() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into profiles(id, display_name, avatar_url)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
          coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'))
  on conflict (id) do nothing;
  return new;
end $$;
update profiles p set avatar_url = coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')
  from auth.users u where u.id = p.id and p.avatar_url is null;

create or replace function efel_update_profile(p_name text, p_efname text, p_platform text, p_contact text, p_avatar text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Συνδέσου πρώτα.'; end if;
  if p_avatar is not null and p_avatar <> '' and p_avatar !~ '^https://(lh[0-9]\.googleusercontent\.com/|[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/)' then
    raise exception 'Μη έγκυρη εικόνα.'; end if;
  update profiles set
    display_name   = coalesce(nullif(left(trim(p_name),40),''), display_name),
    efootball_name = nullif(left(trim(coalesce(p_efname,'')),40),''),
    platform       = case when p_platform in ('console','mobile') then p_platform else null end,
    contact        = nullif(left(trim(coalesce(p_contact,'')),80),''),
    avatar_url     = coalesce(nullif(p_avatar,''), avatar_url)
  where id = auth.uid();
end $$;

-- αποθήκη φωτογραφιών: ο καθένας γράφει μόνο στον δικό του φάκελο
insert into storage.buckets(id, name, public) values ('avatars','avatars', true) on conflict (id) do nothing;
drop policy if exists efel_avatar_write on storage.objects;
create policy efel_avatar_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists efel_avatar_update on storage.objects;
create policy efel_avatar_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Συμβόλαια ----------
create or replace function efel_acquire(c int, pid bigint, cost int, how text) returns void
language plpgsql security definer set search_path=public as $$
declare auto boolean;
begin
  select is_auto into auto from clubs where id = c;
  insert into roster(player_id, club_id, paid, via, activation, activation_deadline, contract_until)
  values (pid, c, cost, how,
          case when auto then 'active' else 'pending' end,
          case when auto then null else now() + make_interval(hours => cfg_int('activation_hours')::int) end,
          cfg_int('season_no') + cfg_int('contract_seasons') - 1);
end $$;
-- υπάρχοντα ρόστερ χωρίς συμβόλαιο: μισοί λήγουν φέτος, μισοί του χρόνου
update roster set contract_until = cfg_int('season_no') + (player_id % 2)::int where contract_until is null;

create or replace function efel_renew(p_player bigint, p_seasons int) returns int
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); r roster; pr int; cost int; sn int := cfg_int('season_no');
begin
  if p_seasons not in (1,2) then raise exception 'Ανανέωση για 1 ή 2 σεζόν.'; end if;
  select * into r from roster where player_id = p_player and club_id = c for update;
  if not found then raise exception 'Ο παίκτης δεν είναι στο ρόστερ σου.'; end if;
  if r.contract_until > sn then raise exception 'Η ανανέωση γίνεται στην τελευταία σεζόν του συμβολαίου.'; end if;
  select price into pr from players where id = p_player;
  cost := (ceil(pr * cfg_int('renew_pct') / 100.0 * p_seasons / 1000) * 1000)::int;
  if (efel_finance(c)->>'free')::bigint < cost then raise exception 'Δεν σου φτάνουν τα ελεύθερα GP για την ανανέωση (%).', efel_fmt(cost); end if;
  update roster set contract_until = r.contract_until + p_seasons where player_id = p_player;
  update clubs set budget = budget - cost where id = c;
  perform efel_news('renew', jsonb_build_object('club', c, 'player', p_player, 'cost', cost, 'until', r.contract_until + p_seasons));
  perform efel_log('renew', jsonb_build_object('player', p_player, 'cost', cost, 'seasons', p_seasons));
  return cost;
end $$;

-- λήξη συμβολαίων στο κλείσιμο της σεζόν: οι παίκτες γίνονται ελεύθεροι και τους διεκδικεί όποιος θέλει.
-- Οι αυτόματοι σύλλογοι ανανεώνουν μόνοι τους περίπου τους μισούς, προτιμώντας τους καλύτερους.
create or replace function efel_expire_contracts(sn int) returns int
language plpgsql security definer set search_path=public as $$
declare r record; n int := 0;
begin
  for r in select ro.*, c.is_auto, p.ovr from roster ro join clubs c on c.id = ro.club_id join players p on p.id = ro.player_id
            where ro.contract_until <= sn loop
    if r.is_auto and random() < 0.3 + least(0.5, greatest(0, (r.ovr - 65) / 40.0)) then
      update roster set contract_until = sn + 1 + (random() < 0.5)::int where player_id = r.player_id;
    else
      delete from roster where player_id = r.player_id;
      update offers set status='invalid', decided_at=now() where status='open' and (player_id=r.player_id or swap_player=r.player_id);
      perform efel_news('contract_end', jsonb_build_object('club', r.club_id, 'player', r.player_id));
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

create or replace function efel_end_season() returns void
language plpgsql security definer set search_path=public as $$
declare lg record; s record; i int; pz jsonb := cfg('prizes'); sn int := cfg_int('season_no'); amt int;
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  if exists (select 1 from season_archive where season_no = sn) then raise exception 'Η σεζόν έχει ήδη κλείσει.'; end if;
  for lg in select * from leagues loop
    i := 0;
    for s in select * from efel_standings(lg.id, sn) loop
      i := i + 1; amt := coalesce((pz ->> (i-1))::int, 0);
      insert into season_archive(season_no, club_id, league_id, position, points, w, d, l, gf, ga, prize, manager_id)
      values (sn, s.club_id, lg.id, i, s.pts, s.w, s.d, s.l, s.gf, s.ga, amt,
              (select user_id from club_managers where club_id = s.club_id and ended_at is null));
      update clubs set budget = budget + amt, earned = earned + amt where id = s.club_id;
    end loop;
    perform efel_news('season_end', jsonb_build_object('season', sn, 'league', lg.id,
      'champion', (select club_id from season_archive where season_no=sn and league_id=lg.id and position=1)), lg.id);
  end loop;
  perform efel_expire_contracts(sn);
  update config set value = to_jsonb(sn + 1) where key = 'season_no';
  update config set value = '"offseason"' where key = 'phase';
  perform efel_log('end_season', jsonb_build_object('season', sn));
end $$;

-- ---------- Αντιπροτάσεις ----------
create or replace function efel_make_offer(p_player bigint, p_gp int, p_swap bigint default null) returns int
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); owner int; e text; oid int;
begin
  if not (cfg('window_open') #>> '{}')::boolean then raise exception 'Η μεταγραφική περίοδος είναι κλειστή.'; end if;
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

-- εσωτερική: καταγράφει αντιπρόταση από τον σύλλογο c (χωρίς έλεγχο χρήστη)
create or replace function efel_counter_internal(o offers, c int, p_gp int, p_swap bigint, p_note text) returns void
language plpgsql security definer set search_path=public as $$
declare other int := case when c = o.from_club then o.to_club else o.from_club end;
begin
  update offers set gp = p_gp, swap_player = p_swap, turn = other, round = o.round + 1, note = p_note,
         expires_at = greatest(expires_at, now() + interval '48 hours'),
         history = history || jsonb_build_array(jsonb_build_object('by', c, 'gp', p_gp, 'swap', p_swap, 'ts', now(), 'note', p_note))
   where id = o.id;
end $$;

create or replace function efel_counter_offer(p_offer int, p_gp int, p_swap bigint, p_note text) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); o offers;
begin
  select * into o from offers where id = p_offer for update;
  if not found or o.status <> 'open' then raise exception 'Η πρόταση δεν είναι πια ανοιχτή.'; end if;
  if coalesce(o.turn, o.to_club) <> c then raise exception 'Περιμένεις απάντηση από τον άλλο σύλλογο.'; end if;
  if o.round >= cfg_int('counter_rounds') then raise exception 'Έφτασε το όριο γύρων: αποδέξου ή απόρριψε.'; end if;
  if p_gp < 0 or (p_gp = 0 and p_swap is null) then raise exception 'Βάλε GP ή παίκτη σε ανταλλαγή.'; end if;
  if p_swap is not null and not exists (select 1 from roster where player_id = p_swap and club_id = o.from_club) then
    raise exception 'Ο παίκτης της ανταλλαγής πρέπει να ανήκει στον αγοραστή.'; end if;
  if c = o.from_club and (efel_finance(c)->>'budget')::bigint - (efel_finance(c)->>'in_offers')::bigint + o.gp < p_gp then
    raise exception 'Δεν σου φτάνουν τα GP.'; end if;
  perform efel_counter_internal(o, c, p_gp, p_swap, nullif(left(trim(coalesce(p_note,'')),200),''));
  perform efel_log('counter', jsonb_build_object('offer', p_offer, 'gp', p_gp, 'swap', p_swap));
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

create or replace function efel_cancel_offer(p_offer int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club();
begin
  update offers set status = 'cancelled', decided_at = now() where id = p_offer and from_club = c and status = 'open';
  if not found then raise exception 'Η πρόταση δεν μπορεί να αποσυρθεί.'; end if;
end $$;

-- ---------- Αγορά αυτόματων: απαντήσεις και αντιπροτάσεις ----------
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

-- ---------- Ραντεβού με εναλλακτικές ώρες ----------
create or replace function efel_propose_slots(p_match int, p_times timestamptz[]) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); m matches; t timestamptz; arr jsonb := '[]';
begin
  select * into m from matches where id = p_match for update;
  if c not in (m.home, m.away) then raise exception 'Δεν είναι δικός σου αγώνας.'; end if;
  if m.status = 'final' then raise exception 'Ο αγώνας έχει ολοκληρωθεί.'; end if;
  if coalesce(array_length(p_times,1),0) = 0 or array_length(p_times,1) > 3 then raise exception 'Πρότεινε από 1 έως 3 ώρες.'; end if;
  foreach t in array p_times loop
    if t < now() then raise exception 'Οι ώρες πρέπει να είναι στο μέλλον.'; end if;
    arr := arr || to_jsonb(t);
  end loop;
  update matches set time_slots = arr, time_proposed = p_times[1], time_proposed_by = c, time_agreed = null, updated_at = now() where id = p_match;
end $$;

create or replace function efel_pick_slot(p_match int, p_time timestamptz) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); m matches;
begin
  select * into m from matches where id = p_match for update;
  if c not in (m.home, m.away) then raise exception 'Δεν είναι δικός σου αγώνας.'; end if;
  if m.time_proposed_by = c then raise exception 'Περιμένεις απάντηση από τον αντίπαλο.'; end if;
  if not (coalesce(m.time_slots, jsonb_build_array(m.time_proposed)) @> jsonb_build_array(to_jsonb(p_time))) then
    raise exception 'Αυτή η ώρα δεν προτάθηκε.'; end if;
  update matches set time_agreed = p_time, updated_at = now() where id = p_match;
end $$;

-- αγορά αυτόματων: τώρα οι απαντήσεις περνούν από το efel_npc_negotiate
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

-- ---------- Αυτόματη μεταγραφική περίοδος ----------
create or replace function efel_window_dates() returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_array(
    jsonb_build_object('label','Προετοιμασίας','from', efel_md_date(1) - cfg_int('window_days')::int, 'to', efel_md_date(1) - 1),
    jsonb_build_object('label','Μεσοπερίοδος','from', efel_md_date(cfg_int('window_mid_after_md')::int) + 1,
                       'to', efel_md_date(cfg_int('window_mid_after_md')::int) + cfg_int('window_days')::int))
$$;

create or replace function efel_window_sync() returns int
language plpgsql security definer set search_path=public as $$
declare w jsonb; want boolean := false; now_open boolean := (cfg('window_open') #>> '{}')::boolean;
begin
  if not coalesce((cfg('window_auto') #>> '{}')::boolean, false) then return 0; end if;
  if (cfg('phase') #>> '{}') <> 'season' then return 0; end if;
  for w in select * from jsonb_array_elements(efel_window_dates()) loop
    if current_date between (w->>'from')::date and (w->>'to')::date then want := true; end if;
  end loop;
  if want <> now_open then
    update config set value = to_jsonb(want) where key = 'window_open';
    perform efel_news('window', jsonb_build_object('open', want));
    return 1;
  end if;
  return 0;
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

-- ---------- Δικαιώματα ----------
revoke execute on function efel_expire_contracts(int), efel_counter_internal(offers,int,int,bigint,text),
  efel_npc_negotiate(), efel_window_sync() from public, anon, authenticated;
grant execute on function efel_update_profile(text,text,text,text,text), efel_renew(bigint,int),
  efel_counter_offer(int,int,bigint,text), efel_propose_slots(int,timestamptz[]), efel_pick_slot(int,timestamptz),
  efel_window_dates() to authenticated;

-- ---------- Screenshot απόδειξης σκορ ----------
alter table matches add column if not exists proof_url text;
create or replace function efel_attach_proof(p_match int, p_url text) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); m matches;
begin
  select * into m from matches where id = p_match for update;
  if c not in (m.home, m.away) then raise exception 'Δεν είναι δικός σου αγώνας.'; end if;
  if p_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/proofs/' then raise exception 'Μη έγκυρη εικόνα.'; end if;
  update matches set proof_url = p_url, updated_at = now() where id = p_match;
end $$;
revoke execute on function efel_attach_proof(int,text) from public, anon;
grant execute on function efel_attach_proof(int,text) to authenticated;
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values ('proofs','proofs', true, 4194304, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing;
drop policy if exists efel_proof_write on storage.objects;
create policy efel_proof_write on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists efel_proof_read on storage.objects;
create policy efel_proof_read on storage.objects for select to authenticated using (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);
