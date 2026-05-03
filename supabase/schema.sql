-- =============================================================
-- UKTTBS · Supabase schema  (ISOLATED in the `ukttbs` schema)
--
-- IMPORTANT: This Supabase project is shared with another app.
-- To keep UKTTBS data fully separate from anything else in this
-- Postgres database, EVERY table, function and policy lives inside
-- the dedicated `ukttbs` schema — NOT in `public`.
--
-- After running this file, you must also:
--   Supabase Studio → Project Settings → API → "Exposed schemas"
--   → add  `ukttbs`  to the list (alongside `public`).
-- Otherwise the JS client will get a 404 from PostgREST.
--
-- Run this file in the Supabase SQL editor (or `supabase db push`).
-- It is safe to re-run.
-- =============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- Dedicated schema — fully isolated from any other app's tables.
-- -------------------------------------------------------------
create schema if not exists ukttbs;

-- Allow PostgREST (anon + authenticated roles) to use the schema.
grant usage on schema ukttbs to anon, authenticated, service_role;

-- -------------------------------------------------------------
-- Profiles  (1:1 with auth.users — but ONLY rows for UKTTBS members)
--
-- A row in ukttbs.profiles is what makes a Supabase user a "UKTTBS
-- member". Users belonging only to the other app on this project
-- never get a row here, so they are invisible to UKTTBS code.
-- -------------------------------------------------------------
create table if not exists ukttbs.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  is_ukttbs_member boolean not null default true,
  created_at timestamptz not null default now(),
  stripe_customer_id text unique
);

alter table ukttbs.profiles enable row level security;

drop policy if exists "profiles: owner read"   on ukttbs.profiles;
drop policy if exists "profiles: owner update" on ukttbs.profiles;
create policy "profiles: owner read"
  on ukttbs.profiles for select using (auth.uid() = id);
create policy "profiles: owner update"
  on ukttbs.profiles for update using (auth.uid() = id);

-- Auto-create a UKTTBS profile ONLY when a user signs up via this site.
-- The site sends user_metadata.app = 'ukttbs' on every signup, and we
-- only mirror those users into ukttbs.profiles. Users belonging to the
-- other app on this Supabase project are skipped.
create or replace function ukttbs.handle_new_user()
returns trigger language plpgsql security definer set search_path = ukttbs, public as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'app', '') = 'ukttbs' then
    insert into ukttbs.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists on_auth_user_created_ukttbs on auth.users;
create trigger on_auth_user_created_ukttbs
  after insert on auth.users
  for each row execute function ukttbs.handle_new_user();

-- Helper: is the current caller a UKTTBS member?
create or replace function ukttbs.is_member()
returns boolean language sql stable security definer set search_path = ukttbs, public as $$
  select exists (
    select 1 from ukttbs.profiles
    where id = auth.uid() and is_ukttbs_member = true
  );
$$;

-- -------------------------------------------------------------
-- Events
-- -------------------------------------------------------------
create table if not exists ukttbs.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  venue text,
  city text,
  starts_at timestamptz not null,
  ends_at   timestamptz,
  ticket_price_pence int not null default 0,
  tickets_available int,
  stripe_ticket_price_id text,
  stripe_raffle_price_id text,
  raffle_enabled boolean not null default true,
  raffle_entries_count int not null default 0,
  image_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now()
);

alter table ukttbs.events enable row level security;
drop policy if exists "events: public read published" on ukttbs.events;
create policy "events: public read published"
  on ukttbs.events for select
  using (status = 'published');

-- -------------------------------------------------------------
-- Orders
-- -------------------------------------------------------------
create table if not exists ukttbs.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references ukttbs.profiles(id) on delete set null,
  email text not null,
  kind text not null check (kind in ('tickets','raffle','hundred_club')),
  event_id uuid references ukttbs.events(id) on delete set null,
  quantity int not null default 1,
  amount_pence int not null,
  currency text not null default 'gbp',
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  status text not null default 'pending' check (status in ('pending','paid','refunded','failed')),
  created_at timestamptz not null default now()
);

alter table ukttbs.orders enable row level security;
drop policy if exists "orders: owner read" on ukttbs.orders;
create policy "orders: owner read"
  on ukttbs.orders for select
  using (auth.uid() = user_id and ukttbs.is_member());

-- -------------------------------------------------------------
-- Raffle entries
-- -------------------------------------------------------------
create table if not exists ukttbs.raffle_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references ukttbs.events(id) on delete cascade,
  order_id uuid not null references ukttbs.orders(id) on delete cascade,
  user_id uuid references ukttbs.profiles(id) on delete set null,
  email text not null,
  ticket_number int not null,
  created_at timestamptz not null default now(),
  unique (event_id, ticket_number)
);

alter table ukttbs.raffle_entries enable row level security;
drop policy if exists "raffle_entries: owner read" on ukttbs.raffle_entries;
create policy "raffle_entries: owner read"
  on ukttbs.raffle_entries for select
  using (auth.uid() = user_id and ukttbs.is_member());

-- -------------------------------------------------------------
-- Subscriptions (100 Club)
-- -------------------------------------------------------------
create table if not exists ukttbs.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references ukttbs.profiles(id) on delete cascade,
  tier text not null check (tier in ('monthly','annual')),
  status text not null check (status in ('active','past_due','canceled','unpaid','incomplete')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  stripe_customer_portal_url text,
  current_period_start timestamptz,
  current_period_end   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ukttbs.subscriptions enable row level security;
drop policy if exists "subs: owner read" on ukttbs.subscriptions;
create policy "subs: owner read"
  on ukttbs.subscriptions for select
  using (auth.uid() = user_id and ukttbs.is_member());

-- -------------------------------------------------------------
-- Next raffle ticket number
-- -------------------------------------------------------------
create or replace function ukttbs.next_raffle_ticket_number(p_event uuid)
returns int language sql as $$
  select coalesce(max(ticket_number), 0) + 1 from ukttbs.raffle_entries where event_id = p_event;
$$;

-- -------------------------------------------------------------
-- Admins (UKTTBS staff allow-list)
-- -------------------------------------------------------------
create table if not exists ukttbs.admins (
  email text primary key,
  note  text,
  created_at timestamptz not null default now()
);
alter table ukttbs.admins enable row level security;

drop policy if exists "admins: self-visible" on ukttbs.admins;
create policy "admins: self-visible"
  on ukttbs.admins for select
  using (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

-- Admin = UKTTBS member whose email is in ukttbs.admins.
create or replace function ukttbs.is_admin()
returns boolean language sql stable security definer set search_path = ukttbs, public as $$
  select exists (
    select 1
      from ukttbs.admins a
      join ukttbs.profiles p on lower(p.email) = lower(a.email)
     where p.id = auth.uid()
       and p.is_ukttbs_member = true
  );
$$;

-- Admin-level RLS extensions
drop policy if exists "events: admin all"          on ukttbs.events;
drop policy if exists "orders: admin read"         on ukttbs.orders;
drop policy if exists "raffle_entries: admin read" on ukttbs.raffle_entries;
drop policy if exists "subs: admin read"           on ukttbs.subscriptions;
drop policy if exists "profiles: admin read"       on ukttbs.profiles;

create policy "events: admin all"
  on ukttbs.events for all using (ukttbs.is_admin()) with check (ukttbs.is_admin());
create policy "orders: admin read"
  on ukttbs.orders for select using (ukttbs.is_admin());
create policy "raffle_entries: admin read"
  on ukttbs.raffle_entries for select using (ukttbs.is_admin());
create policy "subs: admin read"
  on ukttbs.subscriptions for select using (ukttbs.is_admin());
create policy "profiles: admin read"
  on ukttbs.profiles for select using (ukttbs.is_admin());

-- -------------------------------------------------------------
-- Grants for PostgREST
-- -------------------------------------------------------------
grant select on ukttbs.events to anon, authenticated;
grant select, insert, update on ukttbs.profiles to authenticated;
grant select on ukttbs.orders, ukttbs.raffle_entries, ukttbs.subscriptions to authenticated;

-- -------------------------------------------------------------
-- Raffle draws  (audit log of who won what — admin-driven)
--
-- Each row records ONE prize being drawn for ONE event. The draw is done
-- server-side by ukttbs.draw_raffle_winner() so it's:
--   - cryptographically random (uses pgcrypto's gen_random_bytes)
--   - atomic (no entry can be drawn twice for the same event)
--   - auditable (created_at + drawn_by capture the trustee + timestamp)
-- -------------------------------------------------------------
create table if not exists ukttbs.raffle_draws (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references ukttbs.events(id) on delete cascade,
  prize_label text not null,
  prize_rank int not null,                 -- 1 = first prize, 2 = second, ...
  raffle_entry_id uuid not null references ukttbs.raffle_entries(id),
  ticket_number int not null,
  winner_email text not null,
  winner_user_id uuid references ukttbs.profiles(id) on delete set null,
  drawn_by uuid references ukttbs.profiles(id) on delete set null,
  drawn_at timestamptz not null default now(),
  notes text,
  unique (event_id, raffle_entry_id),       -- a ticket can only win once per event
  unique (event_id, prize_rank)             -- one winner per prize rank per event
);

alter table ukttbs.raffle_draws enable row level security;

drop policy if exists "raffle_draws: public read" on ukttbs.raffle_draws;
create policy "raffle_draws: public read"
  on ukttbs.raffle_draws for select using (true);

drop policy if exists "raffle_draws: admin all" on ukttbs.raffle_draws;
create policy "raffle_draws: admin all"
  on ukttbs.raffle_draws for all using (ukttbs.is_admin()) with check (ukttbs.is_admin());

grant select on ukttbs.raffle_draws to anon, authenticated;

-- Atomically draw one random raffle entry that hasn't already won for this
-- event, record it in raffle_draws, and return the winning row.
-- SECURITY DEFINER so it can read raffle_entries / write raffle_draws even
-- though the caller is just an authenticated user (we gate via is_admin()).
create or replace function ukttbs.draw_raffle_winner(
  p_event uuid,
  p_prize_label text,
  p_prize_rank int default null
)
returns ukttbs.raffle_draws
language plpgsql security definer set search_path = ukttbs, public as $$
declare
  v_admin boolean;
  v_rank int;
  v_entry ukttbs.raffle_entries;
  v_row ukttbs.raffle_draws;
begin
  -- Only admins may draw. We re-check here because the function bypasses RLS.
  select ukttbs.is_admin() into v_admin;
  if not v_admin then
    raise exception 'Only UKTTBS admins may draw raffle winners';
  end if;

  -- Pick the next prize rank if not provided.
  if p_prize_rank is null then
    select coalesce(max(prize_rank), 0) + 1 into v_rank
      from ukttbs.raffle_draws where event_id = p_event;
  else
    v_rank := p_prize_rank;
  end if;

  -- Pick a uniformly random entry that hasn't already won for this event.
  -- order by random() over the not-yet-won set.
  select e.* into v_entry
    from ukttbs.raffle_entries e
    where e.event_id = p_event
      and not exists (
        select 1 from ukttbs.raffle_draws d
         where d.event_id = p_event and d.raffle_entry_id = e.id
      )
    order by random()
    limit 1;

  if v_entry.id is null then
    raise exception 'No remaining raffle entries to draw for this event';
  end if;

  insert into ukttbs.raffle_draws (
    event_id, prize_label, prize_rank,
    raffle_entry_id, ticket_number,
    winner_email, winner_user_id, drawn_by
  ) values (
    p_event, p_prize_label, v_rank,
    v_entry.id, v_entry.ticket_number,
    v_entry.email, v_entry.user_id, auth.uid()
  )
  returning * into v_row;

  return v_row;
end; $$;

grant execute on function ukttbs.draw_raffle_winner(uuid, text, int) to authenticated;

-- -------------------------------------------------------------
-- Seed example event (delete when real events exist)
-- -------------------------------------------------------------
insert into ukttbs.events (slug, title, description, venue, city, starts_at, ends_at, ticket_price_pence, status, raffle_enabled)
values
  ('spring-cocktail-2026',
   'Spring Cocktail Party 2026',
   'A sparkling evening of cocktails, canapés and conversation in aid of the UK tea community.',
   'The Tea Building', 'London',
   '2026-04-23 19:00+01', '2026-04-23 23:00+01',
   7500, 'draft', true),
  ('autumn-cocktail-2026',
   'Autumn Cocktail Party 2026',
   'An autumnal evening of cocktails, canapés and conversation in aid of the UK tea community.',
   'The Tea Building', 'London',
   '2026-10-15 19:00+01', '2026-10-15 23:00+01',
   7500, 'draft', true)
on conflict (slug) do nothing;
