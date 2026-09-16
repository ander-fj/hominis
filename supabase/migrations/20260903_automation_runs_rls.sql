-- Correção: automation_runs foi criada sem RLS (qualquer usuário autenticado lia/gravava o histórico).
-- Aplica o mesmo modelo de permissões de automation_rules (leitura admin/gestor, escrita admin).
alter table public.automation_runs enable row level security;

drop policy if exists automation_runs_admin_read on public.automation_runs;
create policy automation_runs_admin_read on public.automation_runs for select
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','gestor')));

drop policy if exists automation_runs_admin_write on public.automation_runs;
create policy automation_runs_admin_write on public.automation_runs for all
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'))
  with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

-- run_operational_health_check_job() é SECURITY DEFINER e continua gravando normalmente (bypassa RLS).
