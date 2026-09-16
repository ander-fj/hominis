create table if not exists public.activity_locations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  latitude double precision,
  longitude double precision,
  accuracy double precision,
  event_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_locations_activity_created
  on public.activity_locations(activity_id, created_at desc);

alter table public.activity_locations enable row level security;

create policy "activity_locations_select_authenticated" on public.activity_locations
for select to authenticated using (true);

create policy "activity_locations_insert_own" on public.activity_locations
for insert to authenticated with check (auth.uid() = user_id);
