-- ============ 08: αξία eFootball/EFEL, εξηγήσεις γύρου, έσοδα έδρας ============
-- Πίνακας αναφοράς: περίπου τι κοστίζει μια standard κάρτα στο eFootball (GP) ανά OVR.
-- Ο Billy τον διορθώνει από τη Διαχείριση με τιμές από το παιχνίδι. Αξία EFEL = αξία eFootball / efel_ratio.
insert into config(key, value) values
 ('efb_gp', '{"64":5000,"65":7000,"66":8000,"67":9000,"68":10000,"69":12000,"70":15000,"71":18000,"72":22000,"73":28000,"74":35000,"75":45000,"76":55000,"77":70000,"78":90000,"79":110000,"80":130000,"81":150000,"82":220000,"83":300000,"84":420000,"85":450000}'),
 ('efel_ratio', '3'),
 ('home_gate', '2000')
on conflict (key) do nothing;

create or replace function efel_efb_value(o int) returns int language plpgsql stable set search_path=public as $$
declare t jsonb := cfg('efb_gp'); lo int; hi int;
begin
  select min(k::int), max(k::int) into lo, hi from jsonb_object_keys(t) k;
  if o > hi then return (t->>hi::text)::int + (o-hi)*30000; end if;
  if o < lo then return (t->>lo::text)::int; end if;
  return coalesce((t->>o::text)::int, (t->>lo::text)::int);
end $$;
create or replace function efel_price_of(o int) returns int language sql stable set search_path=public as $$
  select greatest(cfg_int('min_price'), (round(efel_efb_value(o)::numeric / greatest(1, cfg_int('efel_ratio')) / 1000) * 1000)::int) $$;
create or replace function efel_reprice() returns void
language plpgsql security definer set search_path=public as $$
begin
  update players set price = efel_price_of(ovr) where price is distinct from efel_price_of(ovr);
end $$;

-- αποτέλεσμα και εξήγηση για κάθε κρυφή προσφορά
alter table bids add column if not exists result text, add column if not exists reason text;

create or replace function efel_close_round_internal() returns int
language plpgsql security definer set search_path=public as $$
declare rd bid_rounds; p record; b record; items jsonb := '[]'; rej jsonb := '[]'; e text; k int := 0;
        top int; nv int; ids int[]; spent bigint; minsp bigint; nmin int; win int; txt text; second int; parts text; pa text[];
begin
  select * into rd from bid_rounds where status = 'open' for update limit 1;
  if not found then return 0; end if;
  -- οι παίκτες κατακυρώνονται με σειρά από τη μεγαλύτερη προσφορά προς τη μικρότερη
  for p in select player_id, max(amount) mx, count(*) nb, min(created_at) t0 from bids where round_id = rd.id
            group by player_id order by max(amount) desc, min(created_at) loop
    if exists (select 1 from roster where player_id = p.player_id) then
      update bids set result = 'invalid', reason = 'Ο παίκτης είχε ήδη σύλλογο στο κλείσιμο.' where round_id = rd.id and player_id = p.player_id;
      continue;
    end if;
    -- άκυρες προσφορές (budget, όρια θέσεων)
    for b in select * from bids where round_id = rd.id and player_id = p.player_id loop
      e := efel_check_add(b.club_id, b.player_id, b.amount);
      if e <> '' then update bids set result = 'invalid', reason = 'Η προσφορά δεν μέτρησε: ' || e where id = b.id; end if;
    end loop;
    select max(amount) into top from bids where round_id = rd.id and player_id = p.player_id and result is null;
    if top is null then continue; end if;
    select array_agg(club_id order by club_id), count(*) into ids, nv from bids where round_id = rd.id and player_id = p.player_id and result is null and amount = top;
    select max(amount) into second from bids where round_id = rd.id and player_id = p.player_id and result is null and amount < top;
    win := null;
    if nv = 1 then
      win := ids[1];
      txt := format('Η %s έδωσε την υψηλότερη προσφορά: %s GP%s. Ο παίκτης πηγαίνει στην %s.',
        (select name from clubs where id = win), efel_fmt(top),
        case when second is not null then format(' (επόμενη %s GP)', efel_fmt(second)) else ' (μοναδική προσφορά)' end,
        (select name from clubs where id = win));
    else
      -- ισοπαλία στο ποσό: κερδίζει όποιος έχει ξοδέψει λιγότερα σε παίκτες ως εκείνη την κατακύρωση
      pa := '{}'; minsp := null;
      for b in select c.id, c.name, coalesce((select sum(paid) from roster r where r.club_id = c.id),0) sp
                 from clubs c where c.id = any(ids) order by 3, c.name loop
        pa := pa || format('η %s %s GP', b.name, efel_fmt(b.sp));
        if minsp is null then minsp := b.sp; end if;
      end loop;
      parts := array_to_string(pa[1:array_length(pa,1)-1], ', ') || ' και ' || pa[array_length(pa,1)];
      select count(*) into nmin from clubs c where c.id = any(ids) and coalesce((select sum(paid) from roster r where r.club_id = c.id),0) = minsp;
      txt := format('Προσφέρατε %s %s GP. Ως εκείνη την κατακύρωση είχε ξοδέψει %s.',
        case when nv = 2 then 'και οι δύο' else format('και οι %s', nv) end, efel_fmt(top), parts);
      if nmin = 1 then
        select c.id into win from clubs c where c.id = any(ids) and coalesce((select sum(paid) from roster r where r.club_id = c.id),0) = minsp;
        txt := txt || format(' Ο παίκτης πηγαίνει στην %s.', (select name from clubs where id = win));
      else
        txt := txt || ' Είχατε ξοδέψει τα ίδια, οπότε ο παίκτης απέρριψε τις προτάσεις και μένει ελεύθερος.';
      end if;
    end if;
    update bids set result = case when club_id = win then 'won' else 'lost' end, reason = txt
     where round_id = rd.id and player_id = p.player_id and result is null;
    update bids set result = 'rejected' where round_id = rd.id and player_id = p.player_id and result = 'lost' and win is null;
    if win is null then
      rej := rej || jsonb_build_array(jsonb_build_array(p.player_id, top, nv));
      continue;
    end if;
    perform efel_acquire(win, p.player_id, top, 'bid');
    update clubs set budget = budget - top where id = win;
    k := k + 1;
    items := items || jsonb_build_array(jsonb_build_array(win, p.player_id, top, p.nb));
  end loop;
  update bid_rounds set status = 'closed', closed_at = now() where id = rd.id;
  perform efel_news('round', jsonb_build_object('round', rd.no, 'items', items, 'rejected', rej));
  return k;
end $$;

-- έσοδα έδρας: ο γηπεδούχος παίρνει home_gate σε κάθε επιβεβαιωμένο αγώνα
create or replace function efel_finalize(p_match int, p_hg int, p_ag int, p_sim boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare m matches; pay jsonb; wb int := cfg_int('win_bonus'); db int := cfg_int('draw_bonus'); hgate int := coalesce(cfg_int('home_gate'),0); k text; v int;
begin
  select * into m from matches where id = p_match for update;
  if m.status = 'final' then return; end if;
  pay := case when p_hg > p_ag then jsonb_build_object(m.home::text, wb + hgate)
              when p_hg < p_ag then jsonb_build_object(m.away::text, wb, m.home::text, hgate)
              else jsonb_build_object(m.home::text, db + hgate, m.away::text, db) end;
  pay := (select coalesce(jsonb_object_agg(key, value), '{}') from jsonb_each(pay) where value::int > 0);
  update matches set hg = p_hg, ag = p_ag, status = 'final', paid = pay, simulated = p_sim, updated_at = now() where id = p_match;
  for k, v in select key, value::int from jsonb_each_text(pay) loop
    update clubs set budget = budget + v, earned = earned + v where id = k::int;
  end loop;
  perform efel_news('result', jsonb_build_object('match', p_match, 'home', m.home, 'away', m.away, 'hg', p_hg, 'ag', p_ag, 'md', m.md, 'pay', pay), m.league_id);
end $$;

revoke all on function efel_efb_value(int), efel_price_of(int) from public, anon;
select efel_reprice();
