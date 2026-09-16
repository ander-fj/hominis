-- =============================================================================
-- CRONOV2 - CORRECAO DO SCHEMA REMOTO
-- Aplicar no Supabase Dashboard > SQL Editor (ou via psql).
--
-- Motivo: as migracoes de 20260901 em diante (e algumas de 20260826) nunca
-- foram aplicadas no banco remoto. Sem as tabelas expenses, vehicle_fuelings e
-- vehicle_maintenance_events, a pagina Inicio (Dashboard) falha com
-- PGRST205 e nao carrega nenhum dado.
--
-- Script IDEMPOTENTE: pode ser executado mais de uma vez sem erros.
--
-- Correcoes em relacao aos arquivos originais de migracao:
--   1. Cria public.get_my_role() (usada pelas policies de expenses, mas nunca definida).
--   2. Usa planned_date onde os arquivos originais usavam scheduled_date
--      (a coluna scheduled_date nao existe na tabela activities).
--   3. Indice de notificacoes usa read_at (is_read nao existe).
--   4. Todas as CREATE POLICY sao protegidas contra re-execucao.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Funcoes auxiliares de papel (role)
-- -----------------------------------------------------------------------------
create or replace function public.current_role()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid()
$$;
revoke execute on function public.current_role() from public;
grant execute on function public.current_role() to authenticated;

create or replace function public.get_my_role()
returns text language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.profiles where id = auth.uid()
$$;
revoke execute on function public.get_my_role() from public, anon;
grant execute on function public.get_my_role() to authenticated;

-- -----------------------------------------------------------------------------
-- 2) activity_records: colunas de veiculo + delecao somente admin
-- -----------------------------------------------------------------------------
alter table public.activity_records
  add column if not exists vehicle_id uuid references public.vehicles(id) on delete set null,
  add column if not exists odometer integer,
  add column if not exists receipt_path text;

drop policy if exists "activity_records_delete_all" on public.activity_records;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'activity_records' and policyname = 'activity_records_delete_admin_only') then
    create policy "activity_records_delete_admin_only"
      on public.activity_records for delete to authenticated
      using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3) vehicles: campos de programacao de manutencao / profiles: limiar de alerta
-- -----------------------------------------------------------------------------
alter table public.vehicles
  add column if not exists next_oil_change_odometer integer,
  add column if not exists next_filter_change_odometer integer;

alter table public.profiles
  add column if not exists maintenance_alert_threshold integer not null default 1000;

-- -----------------------------------------------------------------------------
-- 4) Storage: bucket de comprovantes (receipts) + policies
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'receipts') then
    if exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'buckets' and column_name = 'public') then
      execute 'insert into storage.buckets (id, name, public) values (''receipts'', ''receipts'', true)';
    else
      execute 'insert into storage.buckets (id, name) values (''receipts'', ''receipts'')';
    end if;
  end if;
end $$;

drop policy if exists "receipts_select_all" on storage.objects;
drop policy if exists "receipts_insert_all" on storage.objects;
drop policy if exists "receipts_update_all" on storage.objects;
drop policy if exists "receipts_delete_all" on storage.objects;
create policy "receipts_select_all" on storage.objects for select
  to authenticated using (bucket_id = 'receipts');
create policy "receipts_insert_all" on storage.objects for insert
  to authenticated with check (bucket_id = 'receipts');
create policy "receipts_update_all" on storage.objects for update
  to authenticated using (bucket_id = 'receipts') with check (bucket_id = 'receipts');
create policy "receipts_delete_all" on storage.objects for delete
  to authenticated using (bucket_id = 'receipts');

-- -----------------------------------------------------------------------------
-- 5) Trigger de novo usuario endurecida
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role text := new.raw_user_meta_data->>'role';
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    new.email,
    case
      when requested_role in ('admin', 'gestor', 'tecnico', 'financeiro') then requested_role
      else 'tecnico'
    end
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 6) Reforco de permissoes por papel (insert/update/delete restritos)
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['clients','teams','team_members','vehicles','projects','work_orders'] loop
    execute format('drop policy if exists %I on public.%I', t || '_insert_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_role_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_role_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_role_delete', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.current_role() in (''admin'',''gestor''))', t || '_role_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.current_role() in (''admin'',''gestor'')) with check (public.current_role() in (''admin'',''gestor''))', t || '_role_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.current_role() = ''admin'')', t || '_role_delete', t);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 7) Workflow de atividades: prioridade, status ampliados e historico
-- -----------------------------------------------------------------------------
alter table public.activities add column if not exists priority text not null default 'media';
alter table public.activities drop constraint if exists activities_priority_check;
alter table public.activities add constraint activities_priority_check check (priority in ('baixa','media','alta','critica'));
alter table public.activities drop constraint if exists activities_status_check;
alter table public.activities add constraint activities_status_check check (status in ('planejada','em_deslocamento','em_andamento','pausada','aguardando_validacao','concluida','cancelada'));

create table if not exists public.activity_history (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  previous_status text,
  new_status text not null,
  user_id uuid references public.profiles(id) on delete set null,
  description text,
  created_at timestamptz not null default now()
);
alter table public.activity_history enable row level security;
drop policy if exists "activity_history_select_authenticated" on public.activity_history;
create policy "activity_history_select_authenticated" on public.activity_history for select to authenticated using (true);
drop policy if exists "activity_history_insert_authenticated" on public.activity_history;
create policy "activity_history_insert_authenticated" on public.activity_history for insert to authenticated with check (user_id = auth.uid() or public.current_role() in ('admin','gestor'));
create index if not exists idx_activity_history_activity_created on public.activity_history(activity_id, created_at desc);

-- -----------------------------------------------------------------------------
-- 8) Checklists e evidencias
-- -----------------------------------------------------------------------------
create table if not exists public.checklist_templates (
  id uuid primary key default gen_random_uuid(), name text not null, description text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references public.checklist_templates(id) on delete cascade,
  description text not null, required boolean not null default false, position integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.activity_checklist_responses (
  id uuid primary key default gen_random_uuid(), activity_id uuid not null references public.activities(id) on delete cascade,
  item_id uuid not null references public.checklist_items(id) on delete cascade, checked boolean not null default false, notes text,
  created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(activity_id, item_id)
);
create table if not exists public.activity_evidences (
  id uuid primary key default gen_random_uuid(), activity_id uuid not null references public.activities(id) on delete cascade,
  type text not null check (type in ('FOTO_ANTES','FOTO_DURANTE','FOTO_DEPOIS','DOCUMENTO','COMPROVANTE')),
  description text, file_path text not null, created_by uuid references public.profiles(id), created_at timestamptz not null default now()
);
create index if not exists idx_activity_checklist_responses_activity on public.activity_checklist_responses(activity_id);
create index if not exists idx_activity_evidences_activity on public.activity_evidences(activity_id, created_at desc);

alter table public.checklist_templates enable row level security;
alter table public.checklist_items enable row level security;
alter table public.activity_checklist_responses enable row level security;
alter table public.activity_evidences enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='checklist_templates' and policyname='authenticated checklist templates read') then
    create policy "authenticated checklist templates read" on public.checklist_templates for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='checklist_items' and policyname='authenticated checklist items read') then
    create policy "authenticated checklist items read" on public.checklist_items for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activity_checklist_responses' and policyname='activity checklist responses read') then
    create policy "activity checklist responses read" on public.activity_checklist_responses for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activity_checklist_responses' and policyname='activity checklist responses manage') then
    create policy "activity checklist responses manage" on public.activity_checklist_responses for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activity_evidences' and policyname='activity evidences read') then
    create policy "activity evidences read" on public.activity_evidences for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activity_evidences' and policyname='activity evidences insert') then
    create policy "activity evidences insert" on public.activity_evidences for insert to authenticated with check (created_by = auth.uid());
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 9) Despesas (tabela usada pela pagina Inicio)
-- -----------------------------------------------------------------------------
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
create index if not exists idx_expenses_project on public.expenses(project_id);
create index if not exists idx_expenses_user on public.expenses(user_id);
create index if not exists idx_expenses_date on public.expenses(expense_date desc);
alter table public.expenses enable row level security;
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated using (auth.uid() = user_id or public.get_my_role() in ('admin','gestor','financeiro'));
drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses for update to authenticated using (auth.uid() = user_id or public.get_my_role() in ('admin','gestor','financeiro')) with check (auth.uid() = user_id or public.get_my_role() in ('admin','gestor','financeiro'));

-- -----------------------------------------------------------------------------
-- 10) Localizacoes de campo (operacao em campo)
-- -----------------------------------------------------------------------------
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
create index if not exists idx_activity_locations_activity_created on public.activity_locations(activity_id, created_at desc);
alter table public.activity_locations enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activity_locations' and policyname='activity_locations_select_authenticated') then
    create policy "activity_locations_select_authenticated" on public.activity_locations for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='activity_locations' and policyname='activity_locations_insert_own') then
    create policy "activity_locations_insert_own" on public.activity_locations for insert to authenticated with check (auth.uid() = user_id);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 11) Gestao de veiculos: abastecimentos e manutencoes (usadas pela pagina Inicio)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 12) Notificacoes e regras de automacao
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, message text not null,
  level text not null default 'info' check (level in ('info','warning','critical','success')),
  entity_type text, entity_id uuid, read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select using (auth.uid() = user_id);
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null, event_type text not null,
  condition_config jsonb not null default '{}'::jsonb,
  action_config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.automation_rules enable row level security;
drop policy if exists automation_rules_admin_read on public.automation_rules;
create policy automation_rules_admin_read on public.automation_rules for select using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','gestor')));
drop policy if exists automation_rules_admin_write on public.automation_rules;
create policy automation_rules_admin_write on public.automation_rules for all using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')) with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into public.automation_rules(name, event_type, condition_config, action_config)
select * from (values
  ('Atividade atrasada','activity_overdue','{"hours":24}'::jsonb,'{"notification":"critical"}'::jsonb),
  ('Despesa pendente','expense_pending','{"days":3}'::jsonb,'{"notification":"warning"}'::jsonb),
  ('Manutenção preventiva','vehicle_maintenance_due','{"days":15}'::jsonb,'{"notification":"warning"}'::jsonb)
) as v(name, event_type, condition_config, action_config)
where not exists (select 1 from public.automation_rules r where r.name = v.name);

create or replace function public.run_operational_health_check()
returns jsonb language plpgsql security definer set search_path = public as $$
declare created_count integer := 0; r record;
begin
  for r in select a.id, a.title, a.responsible_id from public.activities a
           where a.responsible_id is not null and a.status not in ('concluida','cancelada')
             and a.planned_date is not null and a.planned_date::date < current_date loop
    if not exists(select 1 from public.notifications n where n.user_id = r.responsible_id and n.entity_type = 'activity'
                    and n.entity_id = r.id and n.read_at is null and n.created_at::date = current_date) then
      insert into public.notifications(user_id, title, message, level, entity_type, entity_id)
      values (r.responsible_id, 'Atividade atrasada', 'A atividade "' || r.title || '" está fora do prazo planejado.', 'critical', 'activity', r.id);
      created_count := created_count + 1;
    end if;
  end loop;
  return jsonb_build_object('alerts_created', created_count);
end $$;

-- -----------------------------------------------------------------------------
-- 13) Preferencias e fila de entrega de notificacoes
-- -----------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  push_enabled boolean not null default true,
  email_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  critical_only boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
drop policy if exists "users manage own notification preferences" on public.notification_preferences;
create policy "users manage own notification preferences" on public.notification_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create table if not exists public.notification_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('push','email','whatsapp')),
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notification_delivery_queue enable row level security;
create index if not exists idx_notification_delivery_pending on public.notification_delivery_queue(status, created_at);

-- -----------------------------------------------------------------------------
-- 14) Execucoes de automacao em background + RLS
-- -----------------------------------------------------------------------------
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'RUNNING' check (status in ('RUNNING','SUCCESS','FAILED')),
  alerts_created integer not null default 0,
  error_message text
);
create index if not exists idx_automation_runs_started_at on public.automation_runs(started_at desc);
alter table public.automation_runs enable row level security;
drop policy if exists automation_runs_admin_read on public.automation_runs;
create policy automation_runs_admin_read on public.automation_runs for select
  using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','gestor')));
drop policy if exists automation_runs_admin_write on public.automation_runs;
create policy automation_runs_admin_write on public.automation_runs for all
  using (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create or replace function public.run_operational_health_check_job()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run uuid;
  v_result jsonb := '{"alerts_created":0}'::jsonb;
begin
  insert into public.automation_runs(status) values ('RUNNING') returning id into v_run;
  begin
    v_result := coalesce(public.run_operational_health_check()::jsonb, '{"alerts_created":0}'::jsonb);
    update public.automation_runs
       set status = 'SUCCESS', finished_at = now(), alerts_created = coalesce((v_result->>'alerts_created')::integer, 0)
     where id = v_run;
    return jsonb_build_object('run_id', v_run, 'status', 'SUCCESS', 'result', v_result);
  exception when others then
    update public.automation_runs set status = 'FAILED', finished_at = now(), error_message = sqlerrm where id = v_run;
    return jsonb_build_object('run_id', v_run, 'status', 'FAILED', 'error', sqlerrm);
  end;
end $$;

-- -----------------------------------------------------------------------------
-- 15) Indices de performance (scheduled_date corrigido para planned_date)
-- -----------------------------------------------------------------------------
create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_activities_status_created on public.activities(status, created_at desc);
create index if not exists idx_activities_scheduled_date on public.activities(planned_date);
create index if not exists idx_expenses_month on public.expenses(expense_date) include (amount);
create index if not exists idx_fuelings_month on public.vehicle_fuelings(fueling_date) include (total_amount);
create index if not exists idx_maintenance_month on public.vehicle_maintenance_events(performed_at) include (cost);

create index if not exists idx_activities_created_at on public.activities(created_at desc);
create index if not exists idx_activities_status on public.activities(status);
create index if not exists idx_activities_project_id on public.activities(project_id);
create index if not exists idx_activities_responsible_id on public.activities(responsible_id);
create index if not exists idx_activities_planned_date on public.activities(planned_date);

create index if not exists idx_expenses_date_category on public.expenses(expense_date, category);
create index if not exists idx_activities_planned_date_status on public.activities(planned_date, status);
create index if not exists idx_vehicle_fuelings_date on public.vehicle_fuelings(fueling_date);
create index if not exists idx_vehicle_maintenance_performed_at on public.vehicle_maintenance_events(performed_at);

create index if not exists idx_activities_intelligence on public.activities(planned_date, status, priority);
create index if not exists idx_activities_audit_due_status on public.activities(planned_date, status);
create index if not exists idx_automation_runs_audit_status_created on public.automation_runs(status, started_at desc);
create index if not exists idx_notifications_user_unread_created on public.notifications(user_id, read_at, created_at desc);

-- -----------------------------------------------------------------------------
-- 16) Views de BI/qualidade (scheduled_date corrigido para planned_date)
-- -----------------------------------------------------------------------------
create or replace view public.activity_operational_summary as
select
  planned_date,
  status,
  priority,
  count(*) as total
from public.activities
group by planned_date, status, priority;

create or replace view public.v_operational_quality_summary as
select
  count(*) filter (where status not in ('concluida','cancelada') and planned_date < current_date) as overdue_activities,
  count(*) filter (where status = 'concluida') as completed_activities,
  count(*) as total_activities
from public.activities;

-- =============================================================================
-- FIM - Recarregue a aplicacao. A pagina Inicio deve carregar os dados.
-- =============================================================================






