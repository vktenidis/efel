-- =====================================================================
-- EFEL · eFootball Evolution League · Supabase schema v1
-- Τρέχει μία φορά στο SQL Editor του Supabase (με τη σειρά 01, 02, 03).
-- Κανένας πελάτης δεν γράφει απευθείας σε πίνακα: όλες οι ενέργειες
-- περνούν από τις συναρτήσεις efel_* (security definer) του 02.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Ρυθμίσεις ----------
create table if not exists config (
  key   text primary key,
  value jsonb not null
);
insert into config(key,value) values
  ('budget',        '600000'),
  ('min_price',     '5000'),
  ('max_roster',    '25'),
  ('quota',         '{"GK":3,"DEF":9,"MID":9,"FWD":7}'),
  ('win_bonus',     '10000'),
  ('draw_bonus',    '3000'),
  ('prizes',        '[100000,70000,50000,35000,25000,20000,15000,10000]'),
  ('bids_per_round','8'),
  ('window_open',   'false'),
  ('phase',         '"draft"'),             -- draft | season | offseason
  ('season_no',     '1'),
  ('season_start',  '"2026-12-01"'),
  ('md_every_days', '3'),
  ('activation_hours','72'),
  ('offer_hours',   '72'),
  ('cover_max_ovr', '65'),
  ('rule_version',  '"2026-11-25"')
on conflict (key) do nothing;

-- ---------- Χρήστες ----------
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Manager',
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------- Κόσμος: λίγκες και σύλλογοι ----------
create table if not exists leagues (
  id      serial primary key,
  name    text not null,
  kind    text not null check (kind in ('human','auto')),
  sort    int  not null default 0
);

create table if not exists clubs (
  id         serial primary key,
  league_id  int  not null references leagues(id),
  name       text not null,
  abbr       text not null default '',
  color      text not null default '#888888',
  is_auto    boolean not null default false,
  budget     bigint not null default 0,
  earned     bigint not null default 0,
  lineup     jsonb,                        -- {"f":"4-3-3","xi":[player ids]}
  status     text not null default 'active' check (status in ('active','seeking_manager','interim','suspended')),
  created_at timestamptz not null default now()
);

-- Ιστορικό αναθέσεων: «αποχωρεί ο manager, δεν διαλύεται η ομάδα»
create table if not exists club_managers (
  id         serial primary key,
  club_id    int  not null references clubs(id),
  user_id    uuid not null references profiles(id),
  role       text not null default 'manager' check (role in ('manager','interim')),
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  end_reason text
);
-- ένας ενεργός manager ανά σύλλογο, ένας ενεργός σύλλογος ανά χρήστη
create unique index if not exists one_active_mgr_per_club on club_managers(club_id) where ended_at is null;
create unique index if not exists one_active_club_per_user on club_managers(user_id) where ended_at is null;

-- ---------- Κατάλογος standard παικτών ----------
create table if not exists players (
  id    bigint primary key,     -- eFootball player id
  name  text not null,
  pos   text not null,
  ovr   int  not null,
  img   int  not null default 0, -- θέση στα sprites (0 = χωρίς εικόνα)
  price int  not null default 5000
);
create index if not exists players_ovr on players(ovr desc);

-- ---------- Ρόστερ: ένας κάτοχος σε όλο τον κόσμο ----------
create table if not exists roster (
  player_id   bigint primary key references players(id),
  club_id     int not null references clubs(id),
  paid        int not null default 0,
  acquired_at timestamptz not null default now(),
  via         text not null default 'bid',     -- bid | buy | transfer | swap | auto
  activation  text not null default 'active'
              check (activation in ('pending','active','unable','locked')),
  activation_deadline timestamptz,
  contract_until int                           -- σεζόν λήξης (φάση 3)
);
create index if not exists roster_club on roster(club_id);

-- ---------- Αγώνες ----------
create table if not exists matches (
  id          serial primary key,
  league_id   int not null references leagues(id),
  season_no   int not null,
  md          int not null,
  home        int not null references clubs(id),
  away        int not null references clubs(id),
  hg          int,
  ag          int,
  status      text not null default 'open'
              check (status in ('open','reported','final','disputed')),
  reported_by int references clubs(id),
  time_proposed  timestamptz,
  time_proposed_by int references clubs(id),
  time_agreed    timestamptz,
  paid        jsonb,
  simulated   boolean not null default false,
  updated_at  timestamptz not null default now()
);
create index if not exists matches_league on matches(league_id, season_no, md);

-- ---------- Γύροι κρυφών προσφορών ----------
create table if not exists bid_rounds (
  id         serial primary key,
  season_no  int not null,
  no         int not null,
  status     text not null default 'open' check (status in ('open','closed')),
  closes_at  timestamptz,
  closed_at  timestamptz
);
create table if not exists bids (
  id         serial primary key,
  round_id   int not null references bid_rounds(id),
  club_id    int not null references clubs(id),
  player_id  bigint not null references players(id),
  amount     int not null,
  created_at timestamptz not null default now(),
  unique (round_id, club_id, player_id)
);

-- ---------- Προτάσεις μεταγραφών ----------
create table if not exists offers (
  id          serial primary key,
  from_club   int not null references clubs(id),
  to_club     int not null references clubs(id),
  player_id   bigint not null references players(id),
  gp          int not null default 0,
  swap_player bigint references players(id),
  status      text not null default 'open'
              check (status in ('open','accepted','rejected','cancelled','expired','invalid')),
  note        text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  decided_at  timestamptz
);
create index if not exists offers_open on offers(status) where status='open';

-- ---------- Νέα και ιστορικό ----------
create table if not exists news (
  id        bigserial primary key,
  ts        timestamptz not null default now(),
  league_id int references leagues(id),
  type      text not null,
  payload   jsonb not null default '{}'
);
create index if not exists news_ts on news(ts desc);

create table if not exists audit (
  id      bigserial primary key,
  ts      timestamptz not null default now(),
  actor   uuid,
  action  text not null,
  payload jsonb not null default '{}'
);

-- ---------- Αρχείο σεζόν ----------
create table if not exists season_archive (
  id        serial primary key,
  season_no int not null,
  club_id   int not null references clubs(id),
  league_id int not null references leagues(id),
  position  int not null,
  points    int not null,
  w int, d int, l int, gf int, ga int,
  prize     int not null default 0,
  manager_id uuid,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- Row Level Security: όλοι οι συνδεδεμένοι διαβάζουν, κανείς δεν γράφει
-- απευθείας. Οι προσφορές γύρου φαίνονται μόνο στον σύλλογο που τις έκανε.
-- =====================================================================
alter table config         enable row level security;
alter table profiles       enable row level security;
alter table leagues        enable row level security;
alter table clubs          enable row level security;
alter table club_managers  enable row level security;
alter table players        enable row level security;
alter table roster         enable row level security;
alter table matches        enable row level security;
alter table bid_rounds     enable row level security;
alter table bids           enable row level security;
alter table offers         enable row level security;
alter table news           enable row level security;
alter table audit          enable row level security;
alter table season_archive enable row level security;

do $$
declare t text;
begin
  foreach t in array array['config','profiles','leagues','clubs','club_managers','players',
                           'roster','matches','bid_rounds','offers','news','season_archive']
  loop
    execute format('drop policy if exists read_all on %I', t);
    execute format('create policy read_all on %I for select to authenticated using (true)', t);
  end loop;
end $$;

-- ο σύλλογος του τρέχοντα χρήστη
create or replace function efel_my_club() returns int
language sql stable security definer set search_path=public as $$
  select club_id from club_managers where user_id = auth.uid() and ended_at is null limit 1
$$;

drop policy if exists own_bids on bids;
create policy own_bids on bids for select to authenticated using (club_id = efel_my_club());

drop policy if exists admin_audit on audit;
create policy admin_audit on audit for select to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));

-- νέος χρήστης → profile
create or replace function efel_on_signup() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists efel_signup on auth.users;
create trigger efel_signup after insert on auth.users for each row execute function efel_on_signup();

-- Πρόσβαση ανάγνωσης για τη σελίδα (οι κανόνες RLS παραπάνω αποφασίζουν τι βλέπει ο καθένας)
grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to authenticated;
revoke insert, update, delete on all tables in schema public from anon, authenticated;
