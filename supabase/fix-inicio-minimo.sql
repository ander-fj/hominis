-- =============================================================================
-- CORRECAO MINIMA - Pagina Inicio (Dashboard)
-- Cria as 3 tabelas que faltam e que fazem o dashboard falhar com 404:
--   expenses, vehicle_fuelings, vehicle_maintenance_events
-- Script IDEMPOTENTE (pode executar mais de uma vez).
-- Nota: para o sistema completo (notificacoes, automacao, checklists etc.),
-- execute tambem o script completo: supabase/fix_pending_migrations.sql
-- =============================================================================

-- Funcao auxiliar usada pelas policies de despesas (nao existia no banco)
create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid()
$$;
revoke execute on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated;

-- --------------------------- DESPESAS ----------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid references public.activities(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  user_id uuid references public.profiles(id),
  category text not null,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  approved_amount numeric(14,2),
  approval_comments text,
  receipt_url text,
  expense_date date not null default current_date,
  status text not null default 'pending' check (status in ('draft','pending','under_review','approved','rejected','paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_expenses_status on public.expenses(status);
create index if not exists idx_expenses_date on public.expenses(expense_date desc);
alter table public.expenses enable row level security;
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (auth.uid() = user_id or public.get_my_role() in ('admin','gestor','financeiro'));
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated
  using (auth.uid() = user_id or public.get_my_role() in ('admin','gestor','financeiro'))
  with check (auth.uid() = user_id or public.get_my_role() in ('admin','gestor','financeiro'));

-- ------------------------ ABASTECIMENTOS -------------------------------------
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
create index if not exists idx_vehicle_fuelings_vehicle_date on public.vehicle_fuelings(vehicle_id, fueling_date desc);
alter table public.vehicle_fuelings enable row level security;
drop policy if exists "vehicle_fuelings_authenticated_read" on public.vehicle_fuelings;
create policy "vehicle_fuelings_authenticated_read" on public.vehicle_fuelings for select to authenticated using (true);
drop policy if exists "vehicle_fuelings_authenticated_insert" on public.vehicle_fuelings;
create policy "vehicle_fuelings_authenticated_insert" on public.vehicle_fuelings for insert to authenticated with check (auth.uid() = created_by or created_by is null);

-- -------------------------- MANUTENCOES --------------------------------------
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
create index if not exists idx_vehicle_maintenance_vehicle_date on public.vehicle_maintenance_events(vehicle_id, performed_at desc);
alter table public.vehicle_maintenance_events enable row level security;
drop policy if exists "vehicle_maintenance_authenticated_read" on public.vehicle_maintenance_events;
create policy "vehicle_maintenance_authenticated_read" on public.vehicle_maintenance_events for select to authenticated using (true);
drop policy if exists "vehicle_maintenance_authenticated_insert" on public.vehicle_maintenance_events;
create policy "vehicle_maintenance_authenticated_insert" on public.vehicle_maintenance_events for insert to authenticated with check (auth.uid() = created_by or created_by is null);

-- FIM: recarregue a pagina Inicio (F5). Os 404s desaparecem.
