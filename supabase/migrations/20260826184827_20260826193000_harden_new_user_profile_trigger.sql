/*
# Harden automatic profile creation

1. Purpose
- Prevent account creation from failing when profile metadata contains an unexpected access profile.
- Make the signup trigger resolve the profiles table explicitly and use a controlled search path.

2. Modified database objects
- `public.handle_new_user()` now validates the profile role and writes to `public.profiles` explicitly.
- Unknown or malformed role metadata falls back to `tecnico` instead of violating the profiles check constraint.

3. Security changes
- The SECURITY DEFINER function uses `search_path = public, pg_temp` to avoid object-resolution surprises.
- Direct EXECUTE access is revoked from `public`, `anon`, and `authenticated`; the function remains available to the `auth.users` trigger.

4. Data safety
- No existing rows, columns, or tables are removed or changed.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  requested_role text := NEW.raw_user_meta_data->>'role';
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE
      WHEN requested_role IN ('admin', 'gestor', 'tecnico', 'financeiro') THEN requested_role
      ELSE 'tecnico'
    END
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
