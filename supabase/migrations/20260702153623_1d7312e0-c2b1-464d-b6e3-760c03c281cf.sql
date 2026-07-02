
-- Fix 1: prevent privilege escalation via user_roles inserts/updates/deletes by authenticated users
CREATE POLICY "Only admins insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY "Only admins update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (private.is_admin(auth.uid()))
  WITH CHECK (private.is_admin(auth.uid()));

CREATE POLICY "Only admins delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (private.is_admin(auth.uid()));

-- Fix 2: tighten storage upload policy - require path {uid}/{task_id}/... AND task assigned to user (or admin)
DROP POLICY IF EXISTS "Users upload to their task folder" ON storage.objects;

CREATE POLICY "Users upload to assigned task folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (storage.foldername(name))[1] = (auth.uid())::text
    AND (
      private.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = (storage.foldername(name))[2]
          AND t.assignee_id = auth.uid()
      )
    )
  );
