/* Sprint 2 - Role based access hardening */
CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.current_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_role() TO authenticated;

-- Prevent self-service privilege escalation.
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.current_role() = 'admin')
WITH CHECK (
  public.current_role() = 'admin'
  OR (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
);

-- Only admins manage master data. Everyone authenticated can still read shared operational data.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','teams','team_members','vehicles','projects','work_orders'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.current_role() IN (''admin'',''gestor''))', t || '_role_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.current_role() IN (''admin'',''gestor'')) WITH CHECK (public.current_role() IN (''admin'',''gestor''))', t || '_role_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.current_role() = ''admin'')', t || '_role_delete', t);
  END LOOP;
END $$;

-- Admin-only user administration is already enforced by Edge Functions; keep direct profile inserts owner-only.

-- Activities: managers/admins manage all; technicians may update only activities assigned to them.
DROP POLICY IF EXISTS "activities_insert_all" ON public.activities;
DROP POLICY IF EXISTS "activities_update_all" ON public.activities;
DROP POLICY IF EXISTS "activities_delete_all" ON public.activities;
CREATE POLICY "activities_role_insert" ON public.activities FOR INSERT TO authenticated
WITH CHECK (public.current_role() IN ('admin','gestor'));
CREATE POLICY "activities_role_update" ON public.activities FOR UPDATE TO authenticated
USING (public.current_role() IN ('admin','gestor') OR responsible_id = auth.uid())
WITH CHECK (public.current_role() IN ('admin','gestor') OR responsible_id = auth.uid());
CREATE POLICY "activities_role_delete" ON public.activities FOR DELETE TO authenticated
USING (public.current_role() = 'admin');
