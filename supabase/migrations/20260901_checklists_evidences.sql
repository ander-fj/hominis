-- Sprint 5: checklists e evidências de atividades
create table if not exists checklist_templates (
  id uuid primary key default gen_random_uuid(), name text not null, description text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists checklist_items (
  id uuid primary key default gen_random_uuid(), template_id uuid not null references checklist_templates(id) on delete cascade,
  description text not null, required boolean not null default false, position integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists activity_checklist_responses (
  id uuid primary key default gen_random_uuid(), activity_id uuid not null references activities(id) on delete cascade,
  item_id uuid not null references checklist_items(id) on delete cascade, checked boolean not null default false, notes text,
  created_by uuid references profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(activity_id,item_id)
);
create table if not exists activity_evidences (
  id uuid primary key default gen_random_uuid(), activity_id uuid not null references activities(id) on delete cascade,
  type text not null check (type in ('FOTO_ANTES','FOTO_DURANTE','FOTO_DEPOIS','DOCUMENTO','COMPROVANTE')),
  description text, file_path text not null, created_by uuid references profiles(id), created_at timestamptz not null default now()
);
create index if not exists idx_activity_checklist_responses_activity on activity_checklist_responses(activity_id);
create index if not exists idx_activity_evidences_activity on activity_evidences(activity_id, created_at desc);

alter table checklist_templates enable row level security;
alter table checklist_items enable row level security;
alter table activity_checklist_responses enable row level security;
alter table activity_evidences enable row level security;

-- Ajuste estas policies ao seu modelo de RLS existente, caso já haja regras mais restritivas.
create policy "authenticated checklist templates read" on checklist_templates for select to authenticated using (true);
create policy "authenticated checklist items read" on checklist_items for select to authenticated using (true);
create policy "activity checklist responses read" on activity_checklist_responses for select to authenticated using (true);
create policy "activity checklist responses manage" on activity_checklist_responses for all to authenticated using (true) with check (true);
create policy "activity evidences read" on activity_evidences for select to authenticated using (true);
create policy "activity evidences insert" on activity_evidences for insert to authenticated with check (created_by = auth.uid());
