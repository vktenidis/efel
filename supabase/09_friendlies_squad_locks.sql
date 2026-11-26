-- 09 · 26/11/2026 · ρόστερ 25+5, φιλικά με έσοδα, ενστάσεις με αποδεικτικά, κλείδωμα συναλλαγών (εγκρίθηκε από τον Billy)

-- ---------- Ρόστερ 25+5 ----------
-- max_roster = όριο (30)· squad_target = κανονικό ρόστερ (25): σε αυτό μετρά το απόθεμα και ως εκεί γεμίζουν οι αυτόματοι.
insert into config(key, value) values ('squad_target', '25') on conflict (key) do nothing;
update config set value = '30' where key = 'max_roster';
update config set value = '{"GK":4,"DEF":10,"MID":10,"FWD":8}' where key = 'quota';
insert into config(key, value) values
  ('friendly_fee', '1500'), ('friendly_win', '500'), ('friendly_week_max', '2'), ('friendly_pair_week_max', '1')
on conflict (key) do nothing;

-- σειρά κλειδώματος σε όλες τις συναλλαγές: πρόταση → σύλλογοι (αύξουσα σειρά id) → παίκτες/ρόστερ
create or replace function efel_lock_clubs(ids int[]) returns void
language sql security definer set search_path=public as $$
  select null from (select id from clubs where id = any(ids) order by id for update) x $$;
revoke execute on function efel_lock_clubs(int[]) from public, anon, authenticated;

-- ---------- Κλείδωμα συναλλαγών και απόθεμα ως τους 25 (ίδιες συναρτήσεις με πριν + μία γραμμή) ----------
create or replace function efel_buy_free(p_player bigint) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); pr int; e text;
begin
  perform efel_lock_clubs(array[c]);
  if not (cfg('window_open') #>> '{}')::boolean then raise exception 'Η μεταγραφική περίοδος είναι κλειστή.'; end if;
  perform 1 from players where id = p_player for update;
  if exists (select 1 from roster where player_id = p_player) then raise exception 'Ο παίκτης ανήκει ήδη σε σύλλογο.'; end if;
  select price into pr from players where id = p_player;
  if pr is null then raise exception 'Ο παίκτης δεν υπάρχει στον κατάλογο.'; end if;
  e := efel_check_add(c, p_player, pr); if e <> '' then raise exception '%', e; end if;
  perform efel_acquire(c, p_player, pr, 'buy');
  update clubs set budget = budget - pr where id = c;
  perform efel_news('buy', jsonb_build_object('club', c, 'player', p_player, 'price', pr));
  perform efel_log('buy', jsonb_build_object('player', p_player, 'price', pr));
end $$;

create or replace function efel_renew(p_player bigint, p_seasons int) returns int
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); r roster; pr int; cost int; sn int := cfg_int('season_no');
begin
  perform efel_lock_clubs(array[c]);
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

create or replace function efel_place_bid(p_player bigint, p_amount int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); rd bid_rounds; pr int; n int; other bigint; bud bigint; e text;
begin
  perform efel_lock_clubs(array[c]);
  select * into rd from bid_rounds where status = 'open' limit 1;
  if not found then raise exception 'Δεν υπάρχει ανοιχτός γύρος προσφορών.'; end if;
  if rd.closes_at is not null and now() > rd.closes_at then raise exception 'Ο γύρος έχει λήξει.'; end if;
  if exists (select 1 from roster where player_id = p_player) then raise exception 'Ο παίκτης ανήκει ήδη σε σύλλογο.'; end if;
  select price into pr from players where id = p_player;
  if p_amount < pr then raise exception 'Η ελάχιστη προσφορά είναι % GP.', efel_fmt(pr); end if;
  select count(*) into n from bids where round_id = rd.id and club_id = c and player_id <> p_player;
  if n >= cfg_int('bids_per_round') then raise exception 'Έφτασες το όριο προσφορών του γύρου.'; end if;
  select coalesce(sum(amount),0) into other from bids where round_id = rd.id and club_id = c and player_id <> p_player;
  select budget into bud from clubs where id = c;
  if other + p_amount > bud then raise exception 'Οι προσφορές σου ξεπερνούν το budget.'; end if;
  e := efel_check_add(c, p_player, p_amount);
  if e <> '' then raise exception '%', e; end if;
  insert into bids(round_id, club_id, player_id, amount) values (rd.id, c, p_player, p_amount)
    on conflict (round_id, club_id, player_id) do update set amount = excluded.amount, created_at = now();
end $$;

create or replace function efel_release(p_player bigint) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); r roster; refund int;
begin
  perform efel_lock_clubs(array[c]);
  select * into r from roster where player_id = p_player and club_id = c for update;
  if not found then raise exception 'Ο παίκτης δεν είναι στο ρόστερ σου.'; end if;
  if not (cfg('window_open') #>> '{}')::boolean then raise exception 'Η μεταγραφική περίοδος είναι κλειστή.'; end if;
  refund := (r.paid / 2000) * 1000;
  delete from roster where player_id = p_player;
  update offers set status='invalid', decided_at=now() where status='open' and (player_id=p_player or swap_player=p_player);
  update clubs set budget = budget + refund where id = c;
  perform efel_news('release', jsonb_build_object('club', c, 'player', p_player, 'refund', refund));
  perform efel_log('release', jsonb_build_object('player', p_player, 'refund', refund));
end $$;

create or replace function efel_make_offer(p_player bigint, p_gp int, p_swap bigint default null) returns int
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); owner int; e text; oid int;
begin
  perform efel_lock_clubs(array[c]);
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

create or replace function efel_counter_offer(p_offer int, p_gp int, p_swap bigint, p_note text) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); o offers;
begin
  select * into o from offers where id = p_offer for update;
  if found then perform efel_lock_clubs(array[o.from_club, o.to_club]); end if;
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

create or replace function efel_check_add(c int, pid bigint, cost bigint, minus bigint default null)
returns text language plpgsql stable security definer set search_path=public as $$
declare n int; ng int; g text; q int; bud bigint; maxr int := cfg_int('max_roster'); minp int := cfg_int('min_price');
begin
  select grp(pos) into g from players where id = pid;
  select count(*) into n from roster where club_id = c and player_id is distinct from minus;
  select count(*) into ng from roster r join players p on p.id = r.player_id
    where r.club_id = c and grp(p.pos) = g and r.player_id is distinct from minus;
  q := (cfg('quota') ->> g)::int;
  select budget into bud from clubs where id = c;
  if n >= maxr then return 'Το ρόστερ είναι γεμάτο.'; end if;
  if ng >= q then return format('Έφτασες το όριο θέσης (%s: %s).', g, q); end if;
  if bud - cost < greatest(0, cfg_int('squad_target') - n - 1) * minp then
    return format('Πρέπει να μείνουν %s GP για να κλείσεις το ρόστερ των %s παικτών.', efel_fmt(greatest(0, cfg_int('squad_target') - n - 1) * minp), cfg_int('squad_target'));
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
  reserve := greatest(0, (cfg_int('squad_target') - n) * cfg_int('min_price'));
  return jsonb_build_object('budget', bud, 'in_bids', bids_sum, 'in_offers', offers_sum,
    'reserve', reserve, 'free', bud - bids_sum - offers_sum - reserve, 'roster', n);
end $$;

create or replace function efel_auto_fill(c int) returns int
language plpgsql security definer set search_path=public as $$
declare need jsonb := '{"GK":2,"DEF":8,"MID":8,"FWD":7}'; tiers int[][] := array[[90000,999999],[40000,89999],[15000,39999]];
        plan int[] := array[1,2,2,2,3,3,3,3,3,3]; t int; g text; pid bigint; pr int; k int := 0; i int;
begin
  foreach t in array plan loop
    select x.key into g from jsonb_each_text(need) x
      order by (x.value::int - (select count(*) from roster r join players p on p.id=r.player_id where r.club_id=c and grp(p.pos)=x.key)) desc, random() limit 1;
    select p.id, p.price into pid, pr from players p
     where grp(p.pos) = g and p.price between tiers[t][1] and tiers[t][2]
       and not exists (select 1 from roster r where r.player_id = p.id)
     order by random() limit 1;
    if pid is not null and efel_check_add(c, pid, pr) = '' then
      perform efel_acquire(c, pid, pr, 'auto'); update clubs set budget = budget - pr where id = c; k := k + 1;
    end if;
  end loop;
  for i in 1..40 loop
    exit when (select count(*) from roster where club_id = c) >= cfg_int('squad_target');
    select x.key into g from jsonb_each_text(need) x
      where (select count(*) from roster r join players p on p.id=r.player_id where r.club_id=c and grp(p.pos)=x.key) < x.value::int
      order by random() limit 1;
    exit when g is null;
    select p.id, p.price into pid, pr from players p
     where grp(p.pos) = g and p.price < 15000 and not exists (select 1 from roster r where r.player_id = p.id)
     order by p.price, random() limit 1;
    exit when pid is null;
    if efel_check_add(c, pid, pr) = '' then
      perform efel_acquire(c, pid, pr, 'auto'); update clubs set budget = budget - pr where id = c; k := k + 1;
    end if;
    g := null;
  end loop;
  return k;
end $$;

-- ---------- Φιλικά ----------
create table if not exists friendlies (
  id           serial primary key,
  home         int not null references clubs(id),
  away         int not null references clubs(id),
  proposed_by  int not null references clubs(id),
  slots        jsonb not null default '[]',
  time_agreed  timestamptz,
  status       text not null default 'proposed' check (status in ('proposed','scheduled','reported','final','declined','cancelled','disputed')),
  hg int, ag int, reported_by int references clubs(id),
  proof_url    text,
  paid         jsonb,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (home <> away)
);
create index if not exists friendlies_home on friendlies(home);
create index if not exists friendlies_away on friendlies(away);
alter table friendlies enable row level security;
drop policy if exists read_all on friendlies;
create policy read_all on friendlies for select to authenticated using (true);

create or replace function efel_human_club(c int) returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from club_managers where club_id = c and ended_at is null) $$;

create or replace function efel_friendly_invite(p_opp int, p_home boolean, p_times timestamptz[], p_note text default null) returns int
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); t timestamptz; arr jsonb := '[]'; fid int;
begin
  if p_opp is null or p_opp = c then raise exception 'Διάλεξε αντίπαλο.'; end if;
  if not efel_human_club(p_opp) then raise exception 'Τα φιλικά παίζονται μόνο με συλλόγους που έχουν manager.'; end if;
  if exists (select 1 from friendlies where status in ('proposed','scheduled','reported','disputed')
             and ((home = c and away = p_opp) or (home = p_opp and away = c))) then
    raise exception 'Υπάρχει ήδη ανοιχτό φιλικό με αυτόν τον σύλλογο.'; end if;
  if coalesce(array_length(p_times,1),0) = 0 or array_length(p_times,1) > 3 then raise exception 'Πρότεινε από 1 έως 3 ώρες.'; end if;
  foreach t in array p_times loop
    if t < now() then raise exception 'Οι ώρες πρέπει να είναι στο μέλλον.'; end if;
    arr := arr || to_jsonb(t);
  end loop;
  insert into friendlies(home, away, proposed_by, slots, note)
  values (case when p_home then c else p_opp end, case when p_home then p_opp else c end, c, arr, nullif(left(trim(coalesce(p_note,'')),140),''))
  returning id into fid;
  perform efel_log('friendly_invite', jsonb_build_object('friendly', fid, 'opp', p_opp));
  return fid;
end $$;

create or replace function efel_friendly_slots(p_id int, p_times timestamptz[]) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); f friendlies; t timestamptz; arr jsonb := '[]';
begin
  select * into f from friendlies where id = p_id for update;
  if not found or c not in (f.home, f.away) then raise exception 'Δεν είναι δικό σου φιλικό.'; end if;
  if f.status not in ('proposed','scheduled') then raise exception 'Το φιλικό δεν δέχεται πια αλλαγή ώρας.'; end if;
  if coalesce(array_length(p_times,1),0) = 0 or array_length(p_times,1) > 3 then raise exception 'Πρότεινε από 1 έως 3 ώρες.'; end if;
  foreach t in array p_times loop
    if t < now() then raise exception 'Οι ώρες πρέπει να είναι στο μέλλον.'; end if;
    arr := arr || to_jsonb(t);
  end loop;
  update friendlies set slots = arr, proposed_by = c, time_agreed = null, status = 'proposed', updated_at = now() where id = p_id;
end $$;

create or replace function efel_friendly_accept(p_id int, p_time timestamptz) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); f friendlies;
begin
  select * into f from friendlies where id = p_id for update;
  if not found or c not in (f.home, f.away) then raise exception 'Δεν είναι δικό σου φιλικό.'; end if;
  if f.status <> 'proposed' then raise exception 'Το φιλικό δεν περιμένει απάντηση.'; end if;
  if f.proposed_by = c then raise exception 'Περιμένεις απάντηση από τον αντίπαλο.'; end if;
  if not (f.slots @> jsonb_build_array(to_jsonb(p_time))) then raise exception 'Αυτή η ώρα δεν προτάθηκε.'; end if;
  update friendlies set time_agreed = p_time, status = 'scheduled', updated_at = now() where id = p_id;
end $$;

create or replace function efel_friendly_cancel(p_id int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); f friendlies;
begin
  select * into f from friendlies where id = p_id for update;
  if not found or c not in (f.home, f.away) then raise exception 'Δεν είναι δικό σου φιλικό.'; end if;
  if f.status not in ('proposed','scheduled') then raise exception 'Το φιλικό δεν ακυρώνεται σε αυτή τη φάση.'; end if;
  update friendlies set status = case when f.status = 'proposed' and f.proposed_by <> c then 'declined' else 'cancelled' end, updated_at = now() where id = p_id;
end $$;

create or replace function efel_friendly_report(p_id int, p_hg int, p_ag int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); f friendlies;
begin
  select * into f from friendlies where id = p_id for update;
  if not found or c not in (f.home, f.away) then raise exception 'Δεν είναι δικό σου φιλικό.'; end if;
  if f.status not in ('scheduled','disputed') then raise exception 'Δήλωσε σκορ αφού συμφωνηθεί ώρα και παιχτεί το φιλικό.'; end if;
  if p_hg is null or p_ag is null or p_hg < 0 or p_ag < 0 or p_hg > 30 or p_ag > 30 then raise exception 'Μη έγκυρο σκορ.'; end if;
  update friendlies set hg = p_hg, ag = p_ag, reported_by = c, status = 'reported', updated_at = now() where id = p_id;
end $$;

-- πληρωμή: συμμετοχή friendly_fee σε κάθε σύλλογο + friendly_win στον νικητή (μισό σε ισοπαλία)·
-- πληρώνονται έως friendly_week_max φιλικά ανά σύλλογο και friendly_pair_week_max ανά ζευγάρι σε 7 μέρες.
create or replace function efel_friendly_pay(f friendlies) returns jsonb
language plpgsql security definer set search_path=public as $$
declare fee int := cfg_int('friendly_fee'); win int := cfg_int('friendly_win'); wk int := cfg_int('friendly_week_max');
        pair int := cfg_int('friendly_pair_week_max'); since timestamptz := now() - interval '7 days';
        ph int := 0; pa int := 0; npair int; nh int; na int;
begin
  perform efel_lock_clubs(array[f.home, f.away]);
  select count(*) into npair from friendlies where id <> f.id and status = 'final' and paid is not null and updated_at >= since
    and ((home = f.home and away = f.away) or (home = f.away and away = f.home)) and ((paid->>'h')::int > 0 or (paid->>'a')::int > 0);
  select count(*) into nh from friendlies where id <> f.id and status = 'final' and updated_at >= since
    and ((home = f.home and (paid->>'h')::int > 0) or (away = f.home and (paid->>'a')::int > 0));
  select count(*) into na from friendlies where id <> f.id and status = 'final' and updated_at >= since
    and ((home = f.away and (paid->>'h')::int > 0) or (away = f.away and (paid->>'a')::int > 0));
  if npair < pair then
    if nh < wk then ph := fee + case when f.hg > f.ag then win when f.hg = f.ag then win/2 else 0 end; end if;
    if na < wk then pa := fee + case when f.ag > f.hg then win when f.hg = f.ag then win/2 else 0 end; end if;
  end if;
  if ph > 0 then update clubs set budget = budget + ph where id = f.home; end if;
  if pa > 0 then update clubs set budget = budget + pa where id = f.away; end if;
  return jsonb_build_object('h', ph, 'a', pa);
end $$;

create or replace function efel_friendly_confirm(p_id int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_my_club(); f friendlies; pay jsonb;
begin
  select * into f from friendlies where id = p_id for update;
  if not found or f.status <> 'reported' then raise exception 'Δεν υπάρχει σκορ προς επιβεβαίωση.'; end if;
  if not efel_is_admin() and (c is null or c not in (f.home, f.away) or c = f.reported_by) then
    raise exception 'Το σκορ το επιβεβαιώνει ο αντίπαλος.'; end if;
  pay := efel_friendly_pay(f);
  update friendlies set status = 'final', paid = pay, updated_at = now() where id = p_id;
  perform efel_news('friendly', jsonb_build_object('friendly', p_id, 'home', f.home, 'away', f.away, 'hg', f.hg, 'ag', f.ag, 'pay', pay));
  perform efel_log('friendly_confirm', jsonb_build_object('friendly', p_id, 'pay', pay));
end $$;

create or replace function efel_friendly_dispute(p_id int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); f friendlies;
begin
  select * into f from friendlies where id = p_id for update;
  if not found or f.status <> 'reported' or c not in (f.home, f.away) or c = f.reported_by then raise exception 'Δεν μπορείς να αμφισβητήσεις αυτό το σκορ.'; end if;
  update friendlies set status = 'disputed', updated_at = now() where id = p_id;
end $$;

create or replace function efel_friendly_proof(p_id int, p_url text) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); f friendlies;
begin
  select * into f from friendlies where id = p_id for update;
  if not found or c not in (f.home, f.away) then raise exception 'Δεν είναι δικό σου φιλικό.'; end if;
  if p_url !~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/proofs/' then raise exception 'Μη έγκυρη εικόνα.'; end if;
  update friendlies set proof_url = p_url, updated_at = now() where id = p_id;
end $$;

create or replace function efel_admin_friendly(p_id int, p_hg int, p_ag int) returns void
language plpgsql security definer set search_path=public as $$
declare f friendlies; pay jsonb;
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  select * into f from friendlies where id = p_id for update;
  if not found or f.status = 'final' then raise exception 'Το φιλικό δεν μπορεί να κλείσει.'; end if;
  if p_hg is null then update friendlies set status = 'cancelled', updated_at = now() where id = p_id; return; end if;
  f.hg := p_hg; f.ag := p_ag;
  pay := efel_friendly_pay(f);
  update friendlies set hg = p_hg, ag = p_ag, status = 'final', paid = pay, updated_at = now() where id = p_id;
  perform efel_news('friendly', jsonb_build_object('friendly', p_id, 'home', f.home, 'away', f.away, 'hg', p_hg, 'ag', p_ag, 'pay', pay));
  perform efel_log('admin_friendly', jsonb_build_object('friendly', p_id, 'hg', p_hg, 'ag', p_ag));
end $$;

-- ---------- Ενστάσεις για παράβαση κανονισμού (με υποχρεωτικά αποδεικτικά) ----------
create table if not exists complaints (
  id             serial primary key,
  match_id       int references matches(id),
  friendly_id    int references friendlies(id),
  by_club        int not null references clubs(id),
  against_club   int not null references clubs(id),
  reason         text not null,
  evidence       text[] not null,
  defence        text,
  defence_evidence text[],
  status         text not null default 'open' check (status in ('open','upheld','rejected','withdrawn')),
  decision       text,
  created_at     timestamptz not null default now(),
  defended_at    timestamptz,
  decided_at     timestamptz
);
alter table complaints enable row level security;
drop policy if exists parties_read on complaints;
create policy parties_read on complaints for select to authenticated
  using (efel_is_admin() or by_club = efel_my_club() or against_club = efel_my_club());

create or replace function efel_clean_links(p text[]) returns text[] language sql immutable set search_path=public as $$
  select coalesce(array_agg(left(trim(x), 400)), '{}') from unnest(coalesce(p, '{}')) x where trim(x) ~ '^https://[^\s]+$' $$;

create or replace function efel_complaint_file(p_match int, p_friendly int, p_reason text, p_evidence text[]) returns int
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); other int; ev text[] := efel_clean_links(p_evidence); cid int; m matches; f friendlies;
begin
  if p_match is not null then
    select * into m from matches where id = p_match;
    if not found or c not in (m.home, m.away) then raise exception 'Δεν είναι δικός σου αγώνας.'; end if;
    other := case when m.home = c then m.away else m.home end;
  elsif p_friendly is not null then
    select * into f from friendlies where id = p_friendly;
    if not found or c not in (f.home, f.away) then raise exception 'Δεν είναι δικό σου φιλικό.'; end if;
    other := case when f.home = c then f.away else f.home end;
  else raise exception 'Διάλεξε αγώνα.'; end if;
  if length(trim(coalesce(p_reason,''))) < 20 then raise exception 'Περίγραψε την παράβαση (τουλάχιστον 20 χαρακτήρες).'; end if;
  if coalesce(array_length(ev,1),0) = 0 then raise exception 'Η ένσταση χρειάζεται αποδεικτικό υλικό: σύνδεσμο https σε καταγραφή, live ή screenshot.'; end if;
  insert into complaints(match_id, friendly_id, by_club, against_club, reason, evidence)
  values (p_match, p_friendly, c, other, left(trim(p_reason), 2000), ev[1:5]) returning id into cid;
  perform efel_log('complaint_file', jsonb_build_object('complaint', cid, 'against', other));
  return cid;
end $$;

create or replace function efel_complaint_defend(p_id int, p_text text, p_evidence text[]) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); k complaints;
begin
  select * into k from complaints where id = p_id for update;
  if not found or k.against_club <> c then raise exception 'Η ένσταση δεν αφορά τον σύλλογό σου.'; end if;
  if k.status <> 'open' then raise exception 'Η ένσταση έχει κριθεί.'; end if;
  update complaints set defence = left(trim(coalesce(p_text,'')), 2000), defence_evidence = (efel_clean_links(p_evidence))[1:5], defended_at = now() where id = p_id;
end $$;

create or replace function efel_complaint_withdraw(p_id int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club();
begin
  update complaints set status = 'withdrawn', decided_at = now() where id = p_id and by_club = c and status = 'open';
  if not found then raise exception 'Δεν μπορείς να αποσύρεις αυτή την ένσταση.'; end if;
end $$;

create or replace function efel_admin_complaint(p_id int, p_upheld boolean, p_note text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  update complaints set status = case when p_upheld then 'upheld' else 'rejected' end, decision = left(trim(coalesce(p_note,'')), 2000), decided_at = now()
   where id = p_id and status = 'open';
  if not found then raise exception 'Η ένσταση δεν είναι ανοιχτή.'; end if;
  perform efel_log('admin_complaint', jsonb_build_object('complaint', p_id, 'upheld', p_upheld));
end $$;

revoke execute on function efel_human_club(int), efel_friendly_pay(friendlies), efel_clean_links(text[]) from public, anon, authenticated;
revoke execute on function efel_friendly_invite(int,boolean,timestamptz[],text), efel_friendly_slots(int,timestamptz[]), efel_friendly_accept(int,timestamptz),
  efel_friendly_cancel(int), efel_friendly_report(int,int,int), efel_friendly_confirm(int), efel_friendly_dispute(int), efel_friendly_proof(int,text),
  efel_admin_friendly(int,int,int), efel_complaint_file(int,int,text,text[]), efel_complaint_defend(int,text,text[]), efel_complaint_withdraw(int),
  efel_admin_complaint(int,boolean,text) from public, anon;
grant execute on function efel_friendly_invite(int,boolean,timestamptz[],text), efel_friendly_slots(int,timestamptz[]), efel_friendly_accept(int,timestamptz),
  efel_friendly_cancel(int), efel_friendly_report(int,int,int), efel_friendly_confirm(int), efel_friendly_dispute(int), efel_friendly_proof(int,text),
  efel_admin_friendly(int,int,int), efel_complaint_file(int,int,text,text[]), efel_complaint_defend(int,text,text[]), efel_complaint_withdraw(int),
  efel_admin_complaint(int,boolean,text) to authenticated;

-- ---------- Σειρά αναπληρωματικών (12) ----------
create or replace function efel_save_lineup(p_f text, p_xi jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); bad int;
begin
  select count(*) into bad from jsonb_array_elements_text(p_xi) x
    where x <> '' and x <> 'null' and not exists
      (select 1 from roster r where r.player_id = x::bigint and r.club_id = c and r.activation = 'active');
  if bad > 0 then raise exception 'Στην ενδεκάδα μπαίνουν μόνο ενεργοποιημένοι παίκτες του ρόστερ σου.'; end if;
  update clubs set lineup = coalesce(lineup, '{}'::jsonb) || jsonb_build_object('f', p_f, 'xi', p_xi) where id = c;
end $$;

create or replace function efel_save_bench(p_bench jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); bad int;
begin
  if jsonb_typeof(p_bench) <> 'array' or jsonb_array_length(p_bench) > 12 then raise exception 'Έως 12 αναπληρωματικοί.'; end if;
  select count(*) into bad from jsonb_array_elements_text(p_bench) x
    where not exists (select 1 from roster r where r.player_id::text = x and r.club_id = c);
  if bad > 0 then raise exception 'Στον πάγκο μπαίνουν μόνο παίκτες του ρόστερ σου.'; end if;
  update clubs set lineup = coalesce(lineup, '{}'::jsonb) || jsonb_build_object('bench', p_bench) where id = c;
end $$;
revoke execute on function efel_save_bench(jsonb) from public, anon;
grant execute on function efel_save_bench(jsonb) to authenticated;
