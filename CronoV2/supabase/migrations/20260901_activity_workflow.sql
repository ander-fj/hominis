/* Sprint 3 - Activity workflow, priority and history */
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'media';
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_priority_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_priority_check CHECK (priority IN ('baixa','media','alta','critica'));
ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_status_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_status_check CHECK (status IN ('planejada','em_deslocamento','em_andamento','pausada','aguardando_validacao','concluida','cancelada'));
CREATE TABLE IF NOT EXISTS public.activity_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activity_history_select_authenticated" ON public.activity_history;
CREATE POLICY "activity_history_select_authenticated" ON public.activity_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "activity_history_insert_authenticated" ON public.activity_history;
CREATE POLICY "activity_history_insert_authenticated" ON public.activity_history FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.current_role() IN ('admin','gestor'));
CREATE INDEX IF NOT EXISTS idx_activity_history_activity_created ON public.activity_history(activity_id, created_at DESC);
