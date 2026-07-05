
-- 1) Tighten employee UPDATE on tasks: only status/started_at/completed_at/paused_at may change.
DROP POLICY IF EXISTS "Employees update own task status" ON public.tasks;

CREATE POLICY "Employees update own task status"
ON public.tasks
FOR UPDATE
TO authenticated
USING (assignee_id = auth.uid())
WITH CHECK (
  assignee_id = auth.uid()
);

-- Column-level restriction: revoke broad UPDATE and grant only the mutable columns to authenticated.
-- Admins bypass via the "Admins manage tasks" policy which uses the private.is_admin() check
-- and runs through the service role in server functions.
REVOKE UPDATE ON public.tasks FROM authenticated;
GRANT UPDATE (status, started_at, completed_at, paused_at, updated_at) ON public.tasks TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.tasks TO authenticated;

-- 2) Lock down admin-check functions so authenticated users cannot enumerate admins.
-- The private.is_admin / private.has_role variants are used by RLS policies (SECURITY DEFINER)
-- and remain callable by the policy evaluator. Revoke direct EXECUTE from PUBLIC/authenticated
-- on both schemas' variants; keep service_role access for server-side code.
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO service_role;
