-- Sprint 7: gestão avançada de veículos
create table if not exists public.vehicle_fuelings (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  odometer numeric not null check (odometer >= 0),
  liters numeric not null check (liters > 0),
  total_amount numeric not null check (total_amount >= 0),
  fueling_date timestamptz not null default now(),
  station text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_maintenance_events (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  type text not null check (type in ('oleo','filtro','pneus','freios','revisao','corretiva','seguro','licenciamento','outro')),
  description text,
  odometer numeric not null default 0,
  cost numeric not null default 0,
  performed_at timestamptz not null default now(),
  next_due_odometer numeric,
  next_due_date date,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicle_fuelings_vehicle_date on public.vehicle_fuelings(vehicle_id, fueling_date desc);
create index if not exists idx_vehicle_maintenance_vehicle_date on public.vehicle_maintenance_events(vehicle_id, performed_at desc);
create index if not exists idx_vehicle_maintenance_due_date on public.vehicle_maintenance_events(next_due_date) where next_due_date is not null;

alter table public.vehicle_fuelings enable row level security;
alter table public.vehicle_maintenance_events enable row level security;

drop policy if exists "vehicle_fuelings_authenticated_read" on public.vehicle_fuelings;
create policy "vehicle_fuelings_authenticated_read" on public.vehicle_fuelings for select to authenticated using (true);
drop policy if exists "vehicle_fuelings_authenticated_insert" on public.vehicle_fuelings;
create policy "vehicle_fuelings_authenticated_insert" on public.vehicle_fuelings for insert to authenticated with check (auth.uid() = created_by or created_by is null);

drop policy if exists "vehicle_maintenance_authenticated_read" on public.vehicle_maintenance_events;
create policy "vehicle_maintenance_authenticated_read" on public.vehicle_maintenance_events for select to authenticated using (true);
drop policy if exists "vehicle_maintenance_authenticated_insert" on public.vehicle_maintenance_events;
create policy "vehicle_maintenance_authenticated_insert" on public.vehicle_maintenance_events for insert to authenticated with check (auth.uid() = created_by or created_by is null);
