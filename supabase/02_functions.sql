-- =====================================================================
-- EFEL · κανόνες και ενέργειες (τρέχει μετά το 01_schema.sql)
-- Κάθε ενέργεια: έλεγχος δικαιώματος → έλεγχος κανόνων → αλλαγή μέσα σε
-- μία συναλλαγή → νέα + audit. Αν κάτι αποτύχει, δεν αλλάζει τίποτα.
-- =====================================================================

-- ---------- Βοηθητικά ----------
create or replace function efel_fmt(n bigint) returns text language sql immutable as $$
  select replace(to_char(n, 'FM999,999,999,990'), ',', '.') $$;

create or replace function cfg(k text) returns jsonb language sql stable as $$
  select value from config where key = k $$;
create or replace function cfg_int(k text) returns bigint language sql stable as $$
  select (value #>> '{}')::bigint from config where key = k $$;

create or replace function grp(p text) returns text language sql immutable as $$
  select case when p='GK' then 'GK'
              when p in ('CB','LB','RB') then 'DEF'
              when p in ('DMF','CMF','AMF','LMF','RMF') then 'MID'
              else 'FWD' end $$;

create or replace function efel_is_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false) $$;

create or replace function efel_require_club() returns int
language plpgsql stable security definer set search_path=public as $$
declare c int;
begin
  c := efel_my_club();
  if c is null then raise exception 'Δεν έχεις σύλλογο.'; end if;
  return c;
end $$;

create or replace function efel_log(a text, p jsonb) returns void
language sql security definer set search_path=public as $$
  insert into audit(actor, action, payload) values (auth.uid(), a, p) $$;

create or replace function efel_news(t text, p jsonb, lg int default null) returns void
language sql security definer set search_path=public as $$
  insert into news(type, payload, league_id) values (t, p, lg) $$;

-- ημερομηνία αγωνιστικής
create or replace function efel_md_date(md int) returns date language sql stable as $$
  select ((cfg('season_start') #>> '{}')::date + ((md-1) * cfg_int('md_every_days'))::int) $$;

-- μπορεί ο σύλλογος να προσθέσει τον παίκτη με αυτό το κόστος; '' = ναι
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
  if bud - cost < (maxr - n - 1) * minp then
    return format('Πρέπει να μείνουν %s GP για να κλείσεις το ρόστερ των %s παικτών.', efel_fmt((maxr - n - 1) * minp), maxr);
  end if;
  return '';
end $$;

-- οικονομική εικόνα συλλόγου (ίδια φόρμουλα σε όλες τις οθόνες)
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
  select coalesce(sum(gp),0) into offers_sum from offers where from_club = c and status = 'open';
  reserve := greatest(0, (cfg_int('max_roster') - n) * cfg_int('min_price'));
  return jsonb_build_object('budget', bud, 'in_bids', bids_sum, 'in_offers', offers_sum,
    'reserve', reserve, 'free', bud - bids_sum - offers_sum - reserve, 'roster', n);
end $$;

-- επανατιμολόγηση καταλόγου ανά σειρά OVR (T = πλήθος συλλόγων)
create or replace function efel_reprice() returns void
language plpgsql security definer set search_path=public as $$
declare t int;
begin
  select greatest(count(*), 8) into t from clubs;
  with r as (select id, row_number() over (order by ovr desc, id) - 1 as rk from players)
  update players p set price = case
    when r.rk < 2*t  then round((130000 - 40000.0 * r.rk / greatest(1, 2*t-1)) / 1000) * 1000
    when r.rk < 7*t  then round((70000 - 30000.0 * (r.rk-2*t) / greatest(1, 5*t-1)) / 1000) * 1000
    when r.rk < 17*t then round((35000 - 20000.0 * (r.rk-7*t) / greatest(1, 10*t-1)) / 1000) * 1000
    when r.rk < 27*t then round((12000 - 6000.0 * (r.rk-17*t) / greatest(1, 10*t-1)) / 1000) * 1000
    else cfg_int('min_price') end
  from r where r.id = p.id;
end $$;

-- απόκτηση: ανθρώπινος σύλλογος → αναμονή ενεργοποίησης κάρτας
create or replace function efel_acquire(c int, pid bigint, cost int, how text) returns void
language plpgsql security definer set search_path=public as $$
declare auto boolean;
begin
  select is_auto into auto from clubs where id = c;
  insert into roster(player_id, club_id, paid, via, activation, activation_deadline)
  values (pid, c, cost, how,
          case when auto then 'active' else 'pending' end,
          case when auto then null else now() + make_interval(hours => cfg_int('activation_hours')::int) end);
end $$;

-- ---------- Σύλλογος και ρόστερ ----------
create or replace function efel_claim_club(p_club int) returns void
language plpgsql security definer set search_path=public as $$
declare cl clubs;
begin
  if auth.uid() is null then raise exception 'Συνδέσου πρώτα.'; end if;
  if efel_my_club() is not null then raise exception 'Έχεις ήδη σύλλογο.'; end if;
  select * into cl from clubs where id = p_club for update;
  if cl.is_auto then raise exception 'Οι αυτόματοι σύλλογοι δίνονται μόνο από τη διοργάνωση.'; end if;
  if exists (select 1 from club_managers where club_id = p_club and ended_at is null) then
    raise exception 'Ο σύλλογος έχει ήδη manager.'; end if;
  insert into club_managers(club_id, user_id) values (p_club, auth.uid());
  update clubs set status = 'active' where id = p_club;
  perform efel_news('manager', jsonb_build_object('club', p_club, 'user', auth.uid(), 'event', 'joined'), cl.league_id);
  perform efel_log('claim_club', jsonb_build_object('club', p_club));
end $$;

create or replace function efel_save_lineup(p_f text, p_xi jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); bad int;
begin
  select count(*) into bad from jsonb_array_elements_text(p_xi) x
    where x <> '' and x <> 'null' and not exists
      (select 1 from roster r where r.player_id = x::bigint and r.club_id = c and r.activation = 'active');
  if bad > 0 then raise exception 'Στην ενδεκάδα μπαίνουν μόνο ενεργοποιημένοι παίκτες του ρόστερ σου.'; end if;
  update clubs set lineup = jsonb_build_object('f', p_f, 'xi', p_xi) where id = c;
end $$;

create or replace function efel_release(p_player bigint) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); r roster; refund int;
begin
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

-- ---------- Ενεργοποίηση κάρτας στο eFootball ----------
create or replace function efel_confirm_activation(p_player bigint, p_terms boolean) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); r roster;
begin
  if not p_terms then raise exception 'Πρέπει να επιβεβαιώσεις ότι έχεις την κάρτα στο eFootball.'; end if;
  select * into r from roster where player_id = p_player and club_id = c for update;
  if not found then raise exception 'Ο παίκτης δεν είναι στο ρόστερ σου.'; end if;
  if r.activation = 'active' then return; end if;
  if r.activation = 'locked' and not (cfg('window_open') #>> '{}')::boolean then
    raise exception 'Η ενεργοποίηση είναι κλειδωμένη μέχρι το επόμενο μεταγραφικό παράθυρο.'; end if;
  update roster set activation = 'active', activation_deadline = null where player_id = p_player;
  perform efel_log('activation_confirmed', jsonb_build_object('player', p_player, 'rule', cfg('rule_version')));
end $$;

create or replace function efel_declare_unable(p_player bigint) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club();
begin
  update roster set activation = 'unable'
    where player_id = p_player and club_id = c and activation = 'pending';
  if not found then raise exception 'Δεν υπάρχει εκκρεμής ενεργοποίηση για αυτόν τον παίκτη.'; end if;
  perform efel_log('activation_unable', jsonb_build_object('player', p_player));
end $$;

-- ---------- Γύροι κρυφών προσφορών ----------
create or replace function efel_open_round(p_closes timestamptz) returns int
language plpgsql security definer set search_path=public as $$
declare n int; rid int;
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  if exists (select 1 from bid_rounds where status = 'open') then raise exception 'Υπάρχει ήδη ανοιχτός γύρος.'; end if;
  select coalesce(max(no),0)+1 into n from bid_rounds where season_no = cfg_int('season_no');
  insert into bid_rounds(season_no, no, closes_at) values (cfg_int('season_no'), n, p_closes) returning id into rid;
  perform efel_news('round_open', jsonb_build_object('round', n, 'closes_at', p_closes));
  return rid;
end $$;

create or replace function efel_place_bid(p_player bigint, p_amount int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); rd bid_rounds; pr int; n int; other bigint; bud bigint; e text;
begin
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

create or replace function efel_cancel_bid(p_player bigint) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club();
begin
  delete from bids b using bid_rounds r
   where b.round_id = r.id and r.status = 'open' and b.club_id = c and b.player_id = p_player;
end $$;

-- κλείσιμο γύρου: καλείται από τη διοργάνωση ή αυτόματα από το efel_tick
create or replace function efel_close_round_internal() returns int
language plpgsql security definer set search_path=public as $$
declare rd bid_rounds; b record; won bigint[] := '{}'; items jsonb := '[]'; e text; k int := 0;
begin
  select * into rd from bid_rounds where status = 'open' for update limit 1;
  if not found then return 0; end if;
  for b in
    select bi.*, (select count(*) from bids x where x.round_id = rd.id and x.player_id = bi.player_id) as nb,
           (cfg_int('budget') - c.budget) as spent
      from bids bi join clubs c on c.id = bi.club_id
     where bi.round_id = rd.id
     order by bi.amount desc, (cfg_int('budget') - c.budget) asc, bi.created_at asc
  loop
    continue when b.player_id = any(won);
    continue when exists (select 1 from roster where player_id = b.player_id);
    e := efel_check_add(b.club_id, b.player_id, b.amount);
    continue when e <> '';
    perform efel_acquire(b.club_id, b.player_id, b.amount, 'bid');
    update clubs set budget = budget - b.amount where id = b.club_id;
    won := won || b.player_id; k := k + 1;
    items := items || jsonb_build_array(jsonb_build_array(b.club_id, b.player_id, b.amount, b.nb));
  end loop;
  update bid_rounds set status = 'closed', closed_at = now() where id = rd.id;
  perform efel_news('round', jsonb_build_object('round', rd.no, 'items', items));
  return k;
end $$;

create or replace function efel_close_round() returns int
language plpgsql security definer set search_path=public as $$
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  return efel_close_round_internal();
end $$;

-- ---------- Αγορά ελεύθερων ----------
create or replace function efel_buy_free(p_player bigint) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); pr int; e text;
begin
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

-- ---------- Προτάσεις μεταγραφών ----------
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
  insert into offers(from_club, to_club, player_id, gp, swap_player, expires_at)
  values (c, owner, p_player, p_gp, p_swap, now() + make_interval(hours => cfg_int('offer_hours')::int))
  returning id into oid;
  perform efel_log('offer', jsonb_build_object('offer', oid, 'player', p_player, 'gp', p_gp, 'swap', p_swap));
  return oid;
end $$;

-- εκτέλεση μεταγραφής (κοινή για ανθρώπους και αυτόματους)
-- Αυτόματος σύλλογος που αγοράζει με γεμάτο ρόστερ ή θέση: αποδεσμεύει πρώτα τον πιο αδύναμο της ίδιας ζώνης
-- (ή τον πιο αδύναμο γενικά αν φτάνει), με την κανονική επιστροφή 50%, και το γράφει στα νέα.
create or replace function efel_auto_make_room(c int, pid bigint, minus bigint default null) returns void
language plpgsql security definer set search_path=public as $$
declare g text; rel record; maxr int := cfg_int('max_roster');
begin
  if not coalesce((select is_auto from clubs where id = c), false) then return; end if;
  select grp(pos) into g from players where id = pid;
  if (select count(*) from roster r join players p on p.id=r.player_id where r.club_id=c and grp(p.pos)=g and r.player_id is distinct from minus) >= (cfg('quota')->>g)::int
     or (select count(*) from roster where club_id=c and player_id is distinct from minus) >= maxr then
    select r.player_id, r.paid into rel from roster r join players p on p.id=r.player_id
     where r.club_id=c and r.player_id is distinct from minus
     order by (grp(p.pos)=g) desc, p.ovr asc, r.paid asc limit 1;
    if rel.player_id is null then return; end if;
    delete from roster where player_id = rel.player_id;
    update clubs set budget = budget + floor(rel.paid/2000)*1000 where id = c;
    update offers set status='invalid', decided_at=now() where status='open' and (player_id=rel.player_id or swap_player=rel.player_id);
    perform efel_news('release', jsonb_build_object('club', c, 'player', rel.player_id, 'refund', floor(rel.paid/2000)*1000));
  end if;
end $$;
revoke execute on function efel_auto_make_room(int,bigint,bigint) from public, anon, authenticated;

create or replace function efel_execute_offer(o offers) returns void
language plpgsql security definer set search_path=public as $$
declare rmv roster; rsw roster; e text; fb bigint;
begin
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

create or replace function efel_respond_offer(p_offer int, p_accept boolean, p_terms boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); o offers;
begin
  select * into o from offers where id = p_offer for update;
  if not found or o.status <> 'open' then raise exception 'Η πρόταση δεν είναι πια ανοιχτή.'; end if;
  if o.to_club <> c then raise exception 'Η πρόταση δεν απευθύνεται σε σένα.'; end if;
  if not p_accept then
    update offers set status = 'rejected', decided_at = now() where id = p_offer;
    perform efel_log('offer_rejected', jsonb_build_object('offer', p_offer));
    return;
  end if;
  if o.swap_player is not null and not p_terms then
    raise exception 'Αποδέξου τους όρους: η μεταγραφή είναι οριστική.'; end if;
  perform efel_execute_offer(o);
  perform efel_log('offer_accepted', jsonb_build_object('offer', p_offer, 'rule', cfg('rule_version')));
end $$;

create or replace function efel_cancel_offer(p_offer int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club();
begin
  update offers set status = 'cancelled', decided_at = now() where id = p_offer and from_club = c and status = 'open';
  if not found then raise exception 'Η πρόταση δεν μπορεί να αποσυρθεί.'; end if;
end $$;

-- ---------- Αγώνες ----------
create or replace function efel_finalize(p_match int, p_hg int, p_ag int, p_sim boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare m matches; pay jsonb; wb int := cfg_int('win_bonus'); db int := cfg_int('draw_bonus'); k text; v int;
begin
  select * into m from matches where id = p_match for update;
  if m.status = 'final' then return; end if;
  pay := case when p_hg > p_ag then jsonb_build_object(m.home::text, wb)
              when p_hg < p_ag then jsonb_build_object(m.away::text, wb)
              else jsonb_build_object(m.home::text, db, m.away::text, db) end;
  update matches set hg = p_hg, ag = p_ag, status = 'final', paid = pay, simulated = p_sim, updated_at = now() where id = p_match;
  for k, v in select key, value::int from jsonb_each_text(pay) loop
    update clubs set budget = budget + v, earned = earned + v where id = k::int;
  end loop;
  perform efel_news('result', jsonb_build_object('match', p_match, 'home', m.home, 'away', m.away, 'hg', p_hg, 'ag', p_ag, 'md', m.md, 'pay', pay), m.league_id);
end $$;

create or replace function efel_report_score(p_match int, p_hg int, p_ag int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); m matches;
begin
  select * into m from matches where id = p_match for update;
  if c not in (m.home, m.away) then raise exception 'Δεν είναι δικός σου αγώνας.'; end if;
  if m.status not in ('open','disputed') then raise exception 'Το σκορ έχει ήδη δηλωθεί.'; end if;
  if p_hg < 0 or p_ag < 0 or p_hg > 30 or p_ag > 30 then raise exception 'Μη έγκυρο σκορ.'; end if;
  update matches set hg = p_hg, ag = p_ag, status = 'reported', reported_by = c, updated_at = now() where id = p_match;
  perform efel_log('report_score', jsonb_build_object('match', p_match, 'hg', p_hg, 'ag', p_ag));
end $$;

create or replace function efel_confirm_score(p_match int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_my_club(); m matches;
begin
  select * into m from matches where id = p_match for update;
  if m.status <> 'reported' then raise exception 'Δεν υπάρχει σκορ προς επιβεβαίωση.'; end if;
  if not efel_is_admin() and (c is null or c not in (m.home, m.away) or c = m.reported_by) then
    raise exception 'Το σκορ το επιβεβαιώνει ο αντίπαλος.'; end if;
  perform efel_finalize(p_match, m.hg, m.ag);
  perform efel_log('confirm_score', jsonb_build_object('match', p_match));
end $$;

create or replace function efel_dispute_score(p_match int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); m matches;
begin
  select * into m from matches where id = p_match for update;
  if m.status <> 'reported' or c not in (m.home, m.away) or c = m.reported_by then
    raise exception 'Δεν μπορείς να αμφισβητήσεις αυτό το σκορ.'; end if;
  update matches set status = 'disputed', updated_at = now() where id = p_match;
  perform efel_log('dispute_score', jsonb_build_object('match', p_match, 'hg', m.hg, 'ag', m.ag));
end $$;

create or replace function efel_admin_set_score(p_match int, p_hg int, p_ag int) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  perform efel_finalize(p_match, p_hg, p_ag);
  perform efel_log('admin_set_score', jsonb_build_object('match', p_match, 'hg', p_hg, 'ag', p_ag));
end $$;

create or replace function efel_admin_reopen(p_match int) returns void
language plpgsql security definer set search_path=public as $$
declare m matches; k text; v int;
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  select * into m from matches where id = p_match for update;
  for k, v in select key, value::int from jsonb_each_text(coalesce(m.paid,'{}')) loop
    update clubs set budget = budget - v, earned = earned - v where id = k::int;
  end loop;
  update matches set status = 'open', hg = null, ag = null, paid = null, reported_by = null, updated_at = now() where id = p_match;
  perform efel_log('admin_reopen', jsonb_build_object('match', p_match));
end $$;

create or replace function efel_propose_time(p_match int, p_time timestamptz) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); m matches;
begin
  select * into m from matches where id = p_match for update;
  if c not in (m.home, m.away) then raise exception 'Δεν είναι δικός σου αγώνας.'; end if;
  if m.status = 'final' then raise exception 'Ο αγώνας έχει ολοκληρωθεί.'; end if;
  if p_time < now() then raise exception 'Η ώρα πρέπει να είναι στο μέλλον.'; end if;
  update matches set time_proposed = p_time, time_proposed_by = c, time_agreed = null, updated_at = now() where id = p_match;
end $$;

create or replace function efel_accept_time(p_match int) returns void
language plpgsql security definer set search_path=public as $$
declare c int := efel_require_club(); m matches;
begin
  select * into m from matches where id = p_match for update;
  if c not in (m.home, m.away) or m.time_proposed is null or m.time_proposed_by = c then
    raise exception 'Δεν υπάρχει πρόταση ώρας από τον αντίπαλο.'; end if;
  update matches set time_agreed = m.time_proposed, updated_at = now() where id = p_match;
end $$;

-- ---------- Βαθμολογία ----------
create or replace function efel_standings(p_league int, p_season int default null)
returns table(club_id int, p int, w int, d int, l int, gf int, ga int, pts int, form text)
language sql stable security definer set search_path=public as $$
  with s as (select coalesce(p_season, cfg_int('season_no')::int) as sn),
  rows as (
    select home as club, hg as f, ag as a, md from matches, s where league_id=p_league and season_no=s.sn and status='final'
    union all
    select away, ag, hg, md from matches, s where league_id=p_league and season_no=s.sn and status='final')
  select c.id, count(r.club)::int,
         count(*) filter (where r.f>r.a)::int, count(*) filter (where r.f=r.a)::int, count(*) filter (where r.f<r.a)::int,
         coalesce(sum(r.f),0)::int, coalesce(sum(r.a),0)::int,
         (3*count(*) filter (where r.f>r.a) + count(*) filter (where r.f=r.a))::int,
         coalesce(right(string_agg(case when r.f>r.a then 'W' when r.f=r.a then 'D' else 'L' end, '' order by r.md) filter (where r.club is not null), 5), '')
    from clubs c left join rows r on r.club = c.id
   where c.league_id = p_league
   group by c.id
   order by 8 desc, (coalesce(sum(r.f),0)-coalesce(sum(r.a),0)) desc, coalesce(sum(r.f),0) desc, c.id
$$;

-- ---------- Διοργάνωση ----------
create or replace function efel_set_config(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  insert into config(key, value) values (p_key, p_value) on conflict (key) do update set value = excluded.value;
  perform efel_log('set_config', jsonb_build_object('key', p_key, 'value', p_value));
  if p_key = 'window_open' and p_value = 'true'::jsonb then
    perform efel_news('window', jsonb_build_object('open', true));
  end if;
end $$;

create or replace function efel_generate_fixtures(p_league int) returns int
language plpgsql security definer set search_path=public as $$
declare ids int[]; n int; arr int[]; r int; i int; a int; b int; sn int := cfg_int('season_no'); k int := 0;
begin
  select array_agg(id order by id) into ids from clubs where league_id = p_league;
  n := coalesce(array_length(ids,1),0);
  if n < 2 then return 0; end if;
  if n % 2 = 1 then ids := ids || null::int; n := n + 1; end if;
  delete from matches where league_id = p_league and season_no = sn;
  arr := ids;
  for r in 0..n-2 loop
    for i in 1..n/2 loop
      a := arr[i]; b := arr[n+1-i];
      if a is not null and b is not null then
        if r % 2 = 1 then insert into matches(league_id, season_no, md, home, away) values (p_league, sn, r+1, b, a);
                         insert into matches(league_id, season_no, md, home, away) values (p_league, sn, r+n, a, b);
        else             insert into matches(league_id, season_no, md, home, away) values (p_league, sn, r+1, a, b);
                         insert into matches(league_id, season_no, md, home, away) values (p_league, sn, r+n, b, a);
        end if;
        k := k + 2;
      end if;
    end loop;
    arr := arr[1:1] || arr[n:n] || arr[2:n-1];
  end loop;
  return k;
end $$;
