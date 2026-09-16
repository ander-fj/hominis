-- Sprint 11/12: notifications and proactive automation
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null, message text not null, level text not null default 'info' check(level in ('info','warning','critical','success')),
  entity_type text, entity_id uuid, read_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select using (auth.uid() = user_id);
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(), name text not null, event_type text not null,
  condition_config jsonb not null default '{}'::jsonb, action_config jsonb not null default '{}'::jsonb,
  active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.automation_rules enable row level security;
drop policy if exists automation_rules_admin_read on public.automation_rules;
create policy automation_rules_admin_read on public.automation_rules for select using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','gestor')));
drop policy if exists automation_rules_admin_write on public.automation_rules;
create policy automation_rules_admin_write on public.automation_rules for all using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

insert into public.automation_rules(name,event_type,condition_config,action_config)
select * from (values
 ('Atividade atrasada','activity_overdue','{"hours":24}'::jsonb,'{"notification":"critical"}'::jsonb),
 ('Despesa pendente','expense_pending','{"days":3}'::jsonb,'{"notification":"warning"}'::jsonb),
 ('Manutenção preventiva','vehicle_maintenance_due','{"days":15}'::jsonb,'{"notification":"warning"}'::jsonb)
) as v(name,event_type,condition_config,action_config)
where not exists (select 1 from public.automation_rules r where r.name=v.name);

-- Health check creates alerts for overdue activities. Execute manually or schedule with pg_cron/Edge Function.
create or replace function public.run_operational_health_check()
returns jsonb language plpgsql security definer set search_path=public as $$
declare created_count integer := 0; r record;
begin
 for r in select a.id,a.title,a.responsible_id from activities a where a.responsible_id is not null and a.status not in ('concluida','cancelada') and a.planned_date is not null and a.planned_date::date < current_date loop
   if not exists(select 1 from notifications n where n.user_id=r.responsible_id and n.entity_type='activity' and n.entity_id=r.id and n.read_at is null and n.created_at::date=current_date) then
     insert into notifications(user_id,title,message,level,entity_type,entity_id) values(r.responsible_id,'Atividade atrasada','A atividade "'||r.title||'" está fora do prazo planejado.','critical','activity',r.id);
     created_count := created_count + 1;
   end if;
 end loop;
 return jsonb_build_object('alerts_created',created_count);
end; $$;
