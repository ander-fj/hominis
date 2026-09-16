-- Sprint 17: audit and quality support
create index if not exists idx_activities_audit_due_status on public.activities (scheduled_date, status);
create index if not exists idx_automation_runs_audit_status_created on public.automation_runs (status, created_at desc);

create or replace view public.v_operational_quality_summary as
select
  count(*) filter (where status not in ('concluida','cancelada') and scheduled_date < now()) as overdue_activities,
  count(*) filter (where status = 'concluida') as completed_activities,
  count(*) as total_activities
from public.activities;
