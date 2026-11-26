-- 10 · 26/11/2026 · συμμετοχές παικτών, κυρώσεις μετά από ένσταση, αποκλεισμός (εγκρίθηκε από τον Billy)

-- ---------- Συμμετοχές ----------
-- Καταγράφονται αυτόματα όταν ένας αγώνας ή φιλικό γίνεται τελικό: η αποθηκευμένη ενδεκάδα (xi) και ο πάγκος (bench) κάθε συλλόγου.
create table if not exists appearances (
  id          bigserial primary key,
  match_id    int references matches(id) on delete cascade,
  friendly_id int references friendlies(id) on delete cascade,
  season_no   int not null,
  club_id     int not null references clubs(id),
  player_id   bigint not null,
  kind        text not null check (kind in ('xi','bench')),
  comp        text not null check (comp in ('league','friendly')),
  created_at  timestamptz not null default now()
);
create unique index if not exists appearances_uniq on appearances(coalesce(match_id,0), coalesce(friendly_id,0), player_id);
create index if not exists appearances_player on appearances(season_no, player_id);
alter table appearances enable row level security;
drop policy if exists read_all on appearances;
create policy read_all on appearances for select to authenticated using (true);

create or replace function efel_snapshot_apps(p_match int, p_friendly int, p_season int, p_clubs int[], p_comp text) returns void
language sql security definer set search_path=public as $$
  insert into appearances(match_id, friendly_id, season_no, club_id, player_id, kind, comp)
  select p_match, p_friendly, p_season, c.id, x.pid::bigint, x.kind, p_comp
    from clubs c
    cross join lateral (
      select v as pid, 'xi' as kind from jsonb_array_elements_text(case when jsonb_typeof(c.lineup->'xi') = 'array' then c.lineup->'xi' else '[]' end) v
      union all
      select v, 'bench' from jsonb_array_elements_text(case when jsonb_typeof(c.lineup->'bench') = 'array' then c.lineup->'bench' else '[]' end) v
       where not (case when jsonb_typeof(c.lineup->'xi') = 'array' then c.lineup->'xi' else '[]' end) @> jsonb_build_array(v)
         and not (case when jsonb_typeof(c.lineup->'xi') = 'array' then c.lineup->'xi' else '[]' end) @> jsonb_build_array(case when v ~ '^[0-9]+$' then v::bigint end)
    ) x
   where c.id = any(p_clubs) and x.pid ~ '^[0-9]+$'
     and exists (select 1 from roster r where r.player_id = x.pid::bigint and r.club_id = c.id)
  on conflict do nothing $$;

create or replace function efel_trg_match_apps() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.status = 'final' and old.status is distinct from 'final' then
    begin
      perform efel_snapshot_apps(new.id, null, new.season_no, array[new.home, new.away], 'league');
    exception when others then raise warning 'appearances: %', sqlerrm;
    end;
  elsif old.status = 'final' and new.status <> 'final' then
    delete from appearances where match_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists match_apps on matches;
create trigger match_apps after update of status on matches for each row execute function efel_trg_match_apps();

create or replace function efel_trg_friendly_apps() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.status = 'final' and old.status is distinct from 'final' then
    begin
      perform efel_snapshot_apps(null, new.id, cfg_int('season_no'), array[new.home, new.away], 'friendly');
    exception when others then raise warning 'appearances: %', sqlerrm;
    end;
  elsif old.status = 'final' and new.status <> 'final' then
    delete from appearances where friendly_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists friendly_apps on friendlies;
create trigger friendly_apps after update of status on friendlies for each row execute function efel_trg_friendly_apps();

-- σύνοψη ανά παίκτη και σεζόν (διαβάζεται από τη σελίδα)
create or replace view efel_player_apps with (security_invoker = true) as
  select season_no, player_id, club_id,
         count(*) filter (where comp = 'league' and kind = 'xi')    as starts,
         count(*) filter (where comp = 'league' and kind = 'bench') as bench,
         count(*) filter (where comp = 'friendly' and kind = 'xi')  as fr_starts,
         count(*) filter (where comp = 'friendly' and kind = 'bench') as fr_bench
    from appearances group by season_no, player_id, club_id;
grant select on efel_player_apps to authenticated;

-- ---------- Κυρώσεις και αποκλεισμός ----------
alter table profiles add column if not exists banned boolean not null default false;
alter table profiles add column if not exists banned_reason text;
alter table profiles add column if not exists banned_at timestamptz;

create table if not exists sanctions (
  id           serial primary key,
  complaint_id int references complaints(id),
  club_id      int references clubs(id),
  user_id      uuid references profiles(id),
  kind         text not null check (kind in ('warning','fine','expel','ban')),
  amount       int,
  note         text,
  created_at   timestamptz not null default now()
);
alter table sanctions enable row level security;
drop policy if exists read_all on sanctions;
create policy read_all on sanctions for select to authenticated using (true);

create or replace function efel_admin_sanction(p_club int, p_kind text, p_amount int, p_note text, p_complaint int default null) returns void
language plpgsql security definer set search_path=public as $$
declare u uuid; amt int := greatest(0, coalesce(p_amount, 0));
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  if p_kind not in ('warning','fine','expel','ban') then raise exception 'Άγνωστη κύρωση.'; end if;
  if p_kind = 'fine' and amt = 0 then raise exception 'Βάλε ποσό προστίμου.'; end if;
  select user_id into u from club_managers where club_id = p_club and ended_at is null;
  if p_kind in ('expel','ban') and u is null then raise exception 'Ο σύλλογος δεν έχει manager.'; end if;
  if p_kind = 'fine' then
    perform efel_lock_clubs(array[p_club]);
    update clubs set budget = budget - amt where id = p_club;
  end if;
  if p_kind = 'ban' then
    update profiles set banned = true, banned_reason = left(coalesce(p_note,''), 300), banned_at = now() where id = u;
  end if;
  if p_kind in ('expel','ban') then
    perform efel_end_manager(p_club, case when p_kind = 'ban' then 'Αποκλεισμός: ' else 'Απομάκρυνση: ' end || left(coalesce(p_note,''), 180));
  end if;
  insert into sanctions(complaint_id, club_id, user_id, kind, amount, note) values (p_complaint, p_club, u, p_kind, case when p_kind = 'fine' then amt end, left(coalesce(p_note,''), 1000));
  perform efel_news('sanction', jsonb_build_object('club', p_club, 'kind', p_kind, 'amount', case when p_kind = 'fine' then amt end));
  perform efel_log('admin_sanction', jsonb_build_object('club', p_club, 'kind', p_kind, 'amount', amt, 'complaint', p_complaint));
end $$;

create or replace function efel_admin_unban(p_user uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not efel_is_admin() then raise exception 'Μόνο για τη διοργάνωση.'; end if;
  update profiles set banned = false, banned_reason = null, banned_at = null where id = p_user;
  perform efel_log('admin_unban', jsonb_build_object('user', p_user));
end $$;

-- όποιος έχει αποκλειστεί δεν αναλαμβάνει ξανά σύλλογο
create or replace function efel_claim_club(p_club int) returns void
language plpgsql security definer set search_path=public as $$
declare cl clubs;
begin
  if auth.uid() is null then raise exception 'Συνδέσου πρώτα.'; end if;
  if exists (select 1 from profiles where id = auth.uid() and banned) then raise exception 'Ο λογαριασμός σου έχει αποκλειστεί από τις διοργανώσεις της EFEL.'; end if;
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

revoke execute on function efel_snapshot_apps(int,int,int,int[],text), efel_trg_match_apps(), efel_trg_friendly_apps() from public, anon, authenticated;
revoke execute on function efel_admin_sanction(int,text,int,text,int), efel_admin_unban(uuid) from public, anon;
grant execute on function efel_admin_sanction(int,text,int,text,int), efel_admin_unban(uuid) to authenticated;
