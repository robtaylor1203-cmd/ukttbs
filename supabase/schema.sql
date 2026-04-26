-- =============================================================
-- UKTTBS · Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- =============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  stripe_customer_id text unique
);

alter table public.profiles enable row level security;
create policy "profiles: owner read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: owner update" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------------------------------------
-- Events
-- -------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  venue text,
  city text,
  starts_at timestamptz not null,
  ends_at   timestamptz,
  ticket_price_pence int not null default 0,
  tickets_available int,                       -- null = unlimited
  stripe_ticket_price_id text,                 -- Stripe Price for ticket
  stripe_raffle_price_id text,                 -- Stripe Price for £1 raffle
  raffle_enabled boolean not null default true,
  raffle_entries_count int not null default 0, -- denormalised, updated by webhook
  image_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;
create policy "events: public read published"
  on public.events for select
  using (status = 'published');

-- -------------------------------------------------------------
-- Orders  (tickets + raffle + 100 club one-off payments)
-- -------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  kind text not null check (kind in ('tickets','raffle','hundred_club')),
  event_id uuid references public.events(id) on delete set null,
  quantity int not null default 1,
  amount_pence int not null,
  currency text not null default 'gbp',
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  status text not null default 'pending' check (status in ('pending','paid','refunded','failed')),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
create policy "orders: owner read"
  on public.orders for select
  using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- Raffle entries (each ticket is a row so we can draw winners fairly)
-- -------------------------------------------------------------
create table if not exists public.raffle_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  email text not null,
  ticket_number int not null,
  created_at timestamptz not null default now(),
  unique (event_id, ticket_number)
);

alter table public.raffle_entries enable row level security;
create policy "raffle_entries: owner read"
  on public.raffle_entries for select
  using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- Subscriptions (100 Club)
-- -------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
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

alter table public.subscriptions enable row level security;
create policy "subs: owner read"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- Helpful view: allocate next raffle ticket number
-- -------------------------------------------------------------
create or replace function public.next_raffle_ticket_number(p_event uuid)
returns int language sql as $$
  select coalesce(max(ticket_number), 0) + 1 from public.raffle_entries where event_id = p_event;
$$;

-- -------------------------------------------------------------
-- Admins (simple email allow-list)
--   Add a row per authorised staff email. Matching is case-insensitive.
-- -------------------------------------------------------------
create table if not exists public.admins (
  email text primary key,
  note  text,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- Only admins can read the admin list.
create policy "admins: self-visible"
  on public.admins for select
  using (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

-- Helper for policies elsewhere.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
$$;

-- Extend RLS so admins can manage events and inspect all orders/entries/subs.
create policy "events: admin all"         on public.events         for all    using (public.is_admin()) with check (public.is_admin());
create policy "orders: admin read"        on public.orders         for select using (public.is_admin());
create policy "raffle_entries: admin read" on public.raffle_entries for select using (public.is_admin());
create policy "subs: admin read"          on public.subscriptions  for select using (public.is_admin());
create policy "profiles: admin read"      on public.profiles       for select using (public.is_admin());

-- -------------------------------------------------------------
-- Seed example event (optional — delete when real events exist)
-- -------------------------------------------------------------
insert into public.events (slug, title, description, venue, city, starts_at, ends_at, ticket_price_pence, status, raffle_enabled)
values
  ('spring-cocktail-2026', 'Spring Cocktail Party 2026', 'A sparkling evening of cocktails, canapés and conversation in aid of the UK tea community.', 'The Tea Building', 'London', '2026-04-23 19:00+01', '2026-04-23 23:00+01', 7500, 'draft', true)
on conflict (slug) do nothing;
