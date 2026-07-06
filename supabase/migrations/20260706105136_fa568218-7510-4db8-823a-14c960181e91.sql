-- Restore EXECUTE on role-check functions to authenticated users.
-- RLS policies invoke has_role() / is_admin() during query planning; without
-- EXECUTE on these functions, every policy that references them evaluates
-- as denied for the calling role, hiding all projects/tasks and treating
-- admins as employees. SECURITY DEFINER still runs the body as the owner,
-- so callers cannot enumerate arbitrary rows — they can only ask "does
-- (user_id, role) exist?" which is safe.
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'is_admin'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'private' AND p.proname = 'has_role'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated';
  END IF;
END $$;