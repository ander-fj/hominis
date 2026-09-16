-- Sprint 14: preferences and secure delivery queue. External provider credentials stay in Edge Function secrets.
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
  id uuid primary key default gen_random_uuid(), notification_id uuid not null references public.notifications(id) on delete cascade,
  channel text not null check (channel in ('push','email','whatsapp')),
  status text not null default 'pending' check (status in ('pending','processing','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notification_delivery_queue enable row level security;
create index if not exists idx_notification_delivery_pending on public.notification_delivery_queue(status, created_at);
-- Queue processing must happen only from a service-role Edge Function; no client-side provider credentials.
