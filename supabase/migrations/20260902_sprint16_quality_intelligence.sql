/* Sprint 16 - quality and operational intelligence */
create index if not exists idx_activities_intelligence on public.activities (planned_date, status, priority);

/* View for future BI/reporting integrations. */
create or replace view public.activity_operational_summary as
select
  planned_date,
  status,
  priority,
  count(*) as total
from public.activities
group by planned_date, status, priority;
