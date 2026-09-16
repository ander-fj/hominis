-- Sprint 13: execução automática em background
create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'RUNNING' check (status in ('RUNNING','SUCCESS','FAILED')),
  alerts_created integer not null default 0,
  error_message text
);

create index if not exists idx_automation_runs_started_at on automation_runs(started_at desc);

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
  insert into automation_runs(status) values ('RUNNING') returning id into v_run;
  begin
    v_result := coalesce(public.run_operational_health_check()::jsonb, '{"alerts_created":0}'::jsonb);
    update automation_runs
       set status='SUCCESS', finished_at=now(), alerts_created=coalesce((v_result->>'alerts_created')::integer,0)
     where id=v_run;
    return jsonb_build_object('run_id',v_run,'status','SUCCESS','result',v_result);
  exception when others then
    update automation_runs set status='FAILED', finished_at=now(), error_message=sqlerrm where id=v_run;
    return jsonb_build_object('run_id',v_run,'status','FAILED','error',sqlerrm);
  end;
end;
$$;

-- Execute a configuração abaixo somente se a extensão pg_cron estiver habilitada no seu projeto Supabase.
-- select cron.schedule('operational-health-check-hourly', '0 * * * *', $$select public.run_operational_health_check_job();$$);
