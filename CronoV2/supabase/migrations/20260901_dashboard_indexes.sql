-- Sprint 8: índices para consultas do dashboard
create index if not exists idx_projects_status on public.projects(status);
create index if not exists idx_activities_status_created on public.activities(status, created_at desc);
create index if not exists idx_activities_scheduled_date on public.activities(scheduled_date);
create index if not exists idx_expenses_month on public.expenses(expense_date) include (amount);
create index if not exists idx_fuelings_month on public.vehicle_fuelings(fueling_date) include (total_amount);
create index if not exists idx_maintenance_month on public.vehicle_maintenance_events(performed_at) include (cost);
