create index if not exists idx_expenses_date_category on public.expenses (expense_date, category);
create index if not exists idx_activities_planned_date_status on public.activities (planned_date, status);
create index if not exists idx_vehicle_fuelings_date on public.vehicle_fuelings (fueling_date);
create index if not exists idx_vehicle_maintenance_performed_at on public.vehicle_maintenance_events (performed_at);
