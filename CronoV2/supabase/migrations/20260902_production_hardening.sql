-- Sprint 15: índices e auditoria operacional para produção.
create index if not exists idx_activity_history_activity_created
  on public.activity_history(activity_id, created_at desc);
create index if not exists idx_notifications_user_unread_created
  on public.notifications(user_id, is_read, created_at desc);
create index if not exists idx_automation_runs_created
  on public.automation_runs(created_at desc);

-- Mantenha RLS habilitado em todas as tabelas criadas pelas sprints.
-- Execute esta consulta de auditoria após cada deploy:
-- select schemaname, tablename, rowsecurity from pg_tables
-- where schemaname = 'public' order by tablename;
