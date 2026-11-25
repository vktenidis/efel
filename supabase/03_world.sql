-- =====================================================================
-- EFEL · κόσμος τριών λιγκών, αυτόματοι σύλλογοι, προσομοίωση, cron
-- =====================================================================

-- δύναμη συλλόγου = μέσος όρος των 11 καλύτερων ενεργών OVR
create or replace function efel_strength(c int) returns numeric
language sql stable security definer set search_path=public as $$
  select coalesce(avg(ovr), 60) from (
    select p.ovr from roster r join players p on p.id = r.player_id
     where r.club_id = c and r.activation = 'active'
     order by p.ovr desc limit 11) t
$$;

create or replace function efel_poisson(lambda numeric) returns int
language plpgsql volatile as $$
declare l numeric := exp(-lambda); k int := 0; p numeric := 1;
begin
  loop k := k + 1; p := p * random(); exit when p <= l; end loop;
  return k - 1;
end $$;

-- αυτόματο χτίσιμο ρόστερ: 1 αστέρας, 3 κορυφαίοι, 6 βασικοί, οι υπόλοιποι φθηνοί
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
    exit when (select count(*) from roster where club_id = c) >= cfg_int('max_roster');
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

-- δημιουργία κόσμου: 1 ανθρώπινη + 2 αυτόματες λίγκες, 8 σύλλογοι η καθεμία
create or replace function efel_setup_world() returns text
language plpgsql security definer set search_path=public as $$
declare lh int; la int; lb int; c record; b bigint := cfg_int('budget'); lg int;
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  if exists (select 1 from leagues) then raise exception 'Ο κόσμος έχει ήδη δημιουργηθεί.'; end if;
  insert into leagues(name, kind, sort) values ('EFEL Premier', 'human', 1) returning id into lh;
  insert into leagues(name, kind, sort) values ('EFEL Europa', 'auto', 2) returning id into la;
  insert into leagues(name, kind, sort) values ('EFEL Classic', 'auto', 3) returning id into lb;
  insert into clubs(league_id, name, abbr, color, budget) values
   (lh,'Real Madrid','RMA','#d6a72a',b),(lh,'Barcelona','BAR','#a50044',b),(lh,'Manchester City','MCI','#6cabdd',b),
   (lh,'Bayern München','BAY','#0066b2',b),(lh,'Liverpool','LIV','#c8102e',b),(lh,'Arsenal','ARS','#ef0107',b),
   (lh,'Paris Saint-Germain','PSG','#004170',b),(lh,'Inter','INT','#111111',b);
  update clubs set status = 'seeking_manager' where league_id = lh;
  insert into clubs(league_id, name, abbr, color, budget, is_auto) values
   (la,'Juventus','JUV','#333333',b,true),(la,'Chelsea','CHE','#034694',b,true),(la,'AC Milan','MIL','#c00000',b,true),
   (la,'Atlético Madrid','ATM','#cb3524',b,true),(la,'Borussia Dortmund','BVB','#f5c400',b,true),(la,'Napoli','NAP','#12a0d7',b,true),
   (la,'Manchester United','MUN','#da291c',b,true),(la,'Tottenham','TOT','#132257',b,true),
   (lb,'Benfica','SLB','#e30613',b,true),(lb,'FC Porto','POR','#00428c',b,true),(lb,'Ajax','AJA','#d2122e',b,true),
   (lb,'Olympiacos','OLY','#e2001a',b,true),(lb,'Panathinaikos','PAO','#007a3d',b,true),(lb,'PAOK','PAOK','#1c1c1c',b,true),
   (lb,'AEK Athens','AEK','#f7d117',b,true),(lb,'Celtic','CEL','#008c4a',b,true);
  perform efel_reprice();
  for c in select id from clubs where is_auto order by random() loop perform efel_auto_fill(c.id); end loop;
  for lg in select id from leagues loop perform efel_generate_fixtures(lg); end loop;
  perform efel_news('note', jsonb_build_object('text', 'Ο κόσμος της EFEL δημιουργήθηκε: 3 λίγκες, 24 σύλλογοι.'));
  perform efel_log('setup_world', '{}');
  return 'ok';
end $$;

-- αυτόματοι σύλλογοι στην αγορά (μόνο όταν το παράθυρο είναι ανοιχτό)
create or replace function efel_auto_market() returns int
language plpgsql security definer set search_path=public as $$
declare o offers; a record; r record; sw bigint; need text; have int; tgt int; g int; k int := 0; reason text;
begin
  if not (cfg('window_open') #>> '{}')::boolean then return 0; end if;
  -- 1. απαντήσεις σε προτάσεις προς αυτόματους: δέχονται αν η τιμή είναι ≥ 115% του κόστους τους
  for o in select of.* from offers of join clubs c on c.id = of.to_club where of.status='open' and c.is_auto loop
    select * into r from roster where player_id = o.player_id;
    if r.club_id = o.to_club and o.gp + coalesce((select price from players where id=o.swap_player),0) >= r.paid * 1.15 then
      begin
        perform efel_execute_offer(o); k := k + 1;
      exception when others then
        update offers set status='rejected', decided_at=now(), note='Ο σύλλογος δεν μπορεί να ολοκληρώσει τη μεταγραφή' where id=o.id;
      end;
    else
      update offers set status='rejected', decided_at=now(),
             note = format('Η %s ζητά τουλάχιστον %s GP (ή αντίστοιχη ανταλλαγή).', (select name from clubs where id=o.to_club), efel_fmt((ceil(r.paid*1.15/1000)*1000)::bigint)) where id=o.id;
    end if;
  end loop;
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
    insert into offers(from_club, to_club, player_id, gp, swap_player, expires_at, note)
    values (a.id, r.club_id, r.player_id, g, sw, now() + make_interval(hours => cfg_int('offer_hours')::int), reason);
    k := k + 1;
  end loop;
  return k;
end $$;

-- ο «χρόνος» της EFEL: τρέχει κάθε 15 λεπτά από το pg_cron
create or replace function efel_tick() returns jsonb
language plpgsql security definer set search_path=public as $$
declare m record; hs numeric; as_ numeric; n_sim int := 0; n_exp int; n_lock int; n_round int := 0; n_mkt int;
begin
  -- αγώνες αυτόματων λιγκών που έφτασε η μέρα τους
  for m in select mt.* from matches mt join leagues l on l.id = mt.league_id
            where l.kind = 'auto' and mt.status = 'open' and mt.season_no = cfg_int('season_no')
              and efel_md_date(mt.md) <= current_date and (cfg('phase') #>> '{}') = 'season'
            order by mt.md loop
    hs := efel_strength(m.home); as_ := efel_strength(m.away);
    perform efel_finalize(m.id, efel_poisson(greatest(0.3, 1.45 + (hs-as_)/8)), efel_poisson(greatest(0.3, 1.15 - (hs-as_)/8)), true);
    n_sim := n_sim + 1;
  end loop;
  -- λήξη προτάσεων
  update offers set status = 'expired', decided_at = now() where status = 'open' and expires_at < now();
  get diagnostics n_exp = row_count;
  -- κλείδωμα ενεργοποίησης μετά την προθεσμία (χωρίς επιστροφή GP)
  update roster set activation = 'locked'
   where activation in ('pending','unable') and activation_deadline < now();
  get diagnostics n_lock = row_count;
  -- κλείσιμο γύρου προσφορών στην ώρα του
  if exists (select 1 from bid_rounds where status='open' and closes_at < now()) then
    n_round := efel_close_round_internal();
  end if;
  n_mkt := efel_auto_market();
  return jsonb_build_object('simulated', n_sim, 'expired', n_exp, 'locked', n_lock, 'round_won', n_round, 'market', n_mkt);
end $$;

-- για δοκιμές: η διοργάνωση «τρέχει» τον χρόνο χειροκίνητα
create or replace function efel_admin_tick() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  return efel_tick();
end $$;

-- τέλος σεζόν: αρχείο, έπαθλα ανά λίγκα, νέα σεζόν
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
  update config set value = to_jsonb(sn + 1) where key = 'season_no';
  update config set value = '"offseason"' where key = 'phase';
  perform efel_log('end_season', jsonb_build_object('season', sn));
end $$;

create or replace function efel_new_season_fixtures() returns void
language plpgsql security definer set search_path=public as $$
declare lg int;
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  for lg in select id from leagues loop perform efel_generate_fixtures(lg); end loop;
end $$;

create or replace function efel_reprice_admin() returns void
language plpgsql security definer set search_path=public as $$
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  perform efel_reprice();
end $$;

create or replace function efel_admin_note(p_text text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  perform efel_news('note', jsonb_build_object('text', left(p_text, 500)));
end $$;

create or replace function efel_admin_club(p_club int, p_name text, p_abbr text, p_color text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  update clubs set name = p_name, abbr = upper(left(p_abbr,4)), color = p_color where id = p_club;
  perform efel_log('admin_club', jsonb_build_object('club', p_club, 'name', p_name));
end $$;

-- αποχώρηση/αφαίρεση manager: ο σύλλογος μένει ως έχει (ρόστερ, βαθμοί, GP)
create or replace function efel_end_manager(p_club int, p_reason text) returns void
language plpgsql security definer set search_path=public as $$
declare me int := efel_my_club();
begin
  if not (efel_is_admin() or me = p_club) then raise exception 'Δεν επιτρέπεται.'; end if;
  update club_managers set ended_at = now(), end_reason = left(coalesce(p_reason,''),200)
   where club_id = p_club and ended_at is null;
  update clubs set status = 'seeking_manager' where id = p_club;
  update offers set status = 'cancelled', decided_at = now(), note = 'Αλλαγή manager'
   where status = 'open' and from_club = p_club;
  perform efel_news('manager', jsonb_build_object('club', p_club, 'event', 'left'));
  perform efel_log('end_manager', jsonb_build_object('club', p_club));
end $$;

-- ---------- Δικαιώματα εκτέλεσης ----------
revoke execute on all functions in schema public from public, anon;
grant execute on function
  efel_my_club(), efel_is_admin(), efel_finance(int), efel_standings(int,int), efel_md_date(int),
  efel_claim_club(int), efel_save_lineup(text,jsonb), efel_release(bigint),
  efel_confirm_activation(bigint,boolean), efel_declare_unable(bigint),
  efel_place_bid(bigint,int), efel_cancel_bid(bigint),
  efel_buy_free(bigint), efel_make_offer(bigint,int,bigint), efel_respond_offer(int,boolean,boolean), efel_cancel_offer(int),
  efel_report_score(int,int,int), efel_confirm_score(int), efel_dispute_score(int),
  efel_propose_time(int,timestamptz), efel_accept_time(int),
  efel_open_round(timestamptz), efel_close_round(), efel_admin_set_score(int,int,int), efel_admin_reopen(int),
  efel_set_config(text,jsonb), efel_setup_world(), efel_admin_tick(), efel_end_season(), efel_new_season_fixtures(),
  efel_reprice_admin(), efel_admin_note(text), efel_admin_club(int,text,text,text), efel_end_manager(int,text)
to authenticated;
