create table public.manager_availability (
  id bigint generated always as identity primary key,
  manager_id uuid not null default auth.uid() references public.profiles(id),
  club_id integer not null references public.clubs(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at and ends_at <= starts_at + interval '24 hours'),
  unique (manager_id, starts_at, ends_at)
);
create index manager_availability_day on public.manager_availability(starts_at);
alter table public.manager_availability enable row level security;
revoke all on public.manager_availability from public, anon, authenticated;
grant select, delete on public.manager_availability to authenticated;
grant insert (club_id, starts_at, ends_at) on public.manager_availability to authenticated;
create policy active_availability on public.manager_availability for select to authenticated using (
  exists (select 1 from public.club_managers cm where cm.user_id=manager_id and cm.club_id=manager_availability.club_id and cm.ended_at is null)
);
create policy add_own_availability on public.manager_availability for insert to authenticated with check (
  manager_id=(select auth.uid()) and club_id=(select public.efel_my_club()) and starts_at >= now()
);
create policy remove_own_availability on public.manager_availability for delete to authenticated using (manager_id=(select auth.uid()));

create table public.manager_messages (
  id bigint generated always as identity primary key,
  sender uuid not null default auth.uid() references public.profiles(id),
  recipient uuid not null references public.profiles(id),
  body text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (sender <> recipient)
);
create index manager_messages_recipient on public.manager_messages(recipient, id desc);
create index manager_messages_sender on public.manager_messages(sender, id desc);
alter table public.manager_messages enable row level security;
revoke all on public.manager_messages from public, anon, authenticated;
grant select on public.manager_messages to authenticated;
grant insert (recipient, body) on public.manager_messages to authenticated;
create policy participants_read on public.manager_messages for select to authenticated
  using ((select auth.uid()) in (sender,recipient));
create policy active_managers_send on public.manager_messages for insert to authenticated with check (
  sender=(select auth.uid()) and (select public.efel_my_club()) is not null and
  exists (select 1 from public.club_managers cm where cm.user_id=recipient and cm.ended_at is null)
);

-- Record the optional private note and the actual proposal in one transaction.
create function public.efel_calendar_propose(p_match int, p_time timestamptz, p_note text default '')
returns void language plpgsql security invoker set search_path='' as $$
declare opponent int; manager uuid;
begin
  select case when m.home=public.efel_my_club() then m.away else m.home end into opponent
    from public.matches m where m.id=p_match and public.efel_my_club() in (m.home,m.away) and m.status='open';
  if opponent is null or p_time is null or p_time<=now() then raise exception 'Διάλεξε εκκρεμή αγώνα και μελλοντική ώρα.'; end if;
  perform public.efel_propose_slots(p_match,array[p_time]);
  if nullif(trim(p_note),'') is not null then
    select user_id into manager from public.club_managers where club_id=opponent and ended_at is null;
    if manager is null then raise exception 'Ο αντίπαλος δεν έχει ενεργό manager για να λάβει μήνυμα.'; end if;
    insert into public.manager_messages(recipient, body) values(manager,'Αγώνας #' || p_match || ' · ' || p_note);
  end if;
end $$;
revoke all on function public.efel_calendar_propose(int,timestamptz,text) from public,anon;
grant execute on function public.efel_calendar_propose(int,timestamptz,text) to authenticated;

-- Read confirmed matches directly, including those beyond the recent activity feed.
create view public.efel_friendly_relationships with (security_invoker=true) as
select least(home,away) as club_a, greatest(home,away) as club_b, count(*)::int as played,
  count(*) filter (where updated_at >= now()-interval '7 days' and
    (paid->>case when home<away then 'h' else 'a' end)::int>0)::int as paid_a_week,
  count(*) filter (where updated_at >= now()-interval '7 days' and
    (paid->>case when home<away then 'a' else 'h' end)::int>0)::int as paid_b_week
from public.friendlies where status='final' group by 1,2;
revoke all on public.efel_friendly_relationships from public,anon,authenticated;
grant select on public.efel_friendly_relationships to authenticated;

update public.config set value='8' where key='friendly_week_max';
update public.config set value='3' where key='friendly_pair_week_max';

create function public.efel_calendar_friendly(p_opp int,p_home boolean,p_time timestamptz,p_note text default '')
returns int language plpgsql security invoker set search_path='' as $$
declare fid int; manager uuid; own_club int := public.efel_my_club();
begin
  if p_time is null or p_time<=now() then raise exception 'Διάλεξε μελλοντική ώρα.'; end if;
  if own_club is null or p_opp is null or own_club=p_opp then raise exception 'Διάλεξε αντίπαλο σύλλογο.'; end if;
  -- Reciprocal invites share a lock until the first transaction commits.
  perform pg_catalog.pg_advisory_xact_lock(least(own_club,p_opp), greatest(own_club,p_opp));
  fid := public.efel_friendly_invite(p_opp,p_home,array[p_time],null);
  if nullif(trim(p_note),'') is not null then
    select user_id into strict manager from public.club_managers where club_id=p_opp and ended_at is null;
    insert into public.manager_messages(recipient,body) values(manager,'Φιλικό #' || fid || ' · ' || p_note);
  end if;
  return fid;
end $$;
revoke all on function public.efel_calendar_friendly(int,boolean,timestamptz,text) from public,anon;
grant execute on function public.efel_calendar_friendly(int,boolean,timestamptz,text) to authenticated;
