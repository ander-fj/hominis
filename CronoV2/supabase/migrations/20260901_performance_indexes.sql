-- Execute in Supabase SQL Editor after validating the existing schema.
create index if not exists idx_activities_created_at on public.activities (created_at desc);
create index if not exists idx_activities_status on public.activities (status);
create index if not exists idx_activities_project_id on public.activities (project_id);
create index if not exists idx_activities_responsible_id on public.activities (responsible_id);
create index if not exists idx_activities_planned_date on public.activities (planned_date);
