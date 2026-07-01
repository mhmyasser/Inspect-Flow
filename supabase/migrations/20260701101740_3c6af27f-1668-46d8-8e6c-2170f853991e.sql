
-- 1) Move SECURITY DEFINER helpers to a private schema (not exposed via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION private.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE OR REPLACE FUNCTION private.user_has_task_in_project(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.project_stages s ON s.id = t.stage_id
    WHERE s.project_id = _project_id AND t.assignee_id = _user_id
  )
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.user_has_task_in_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.user_has_task_in_project(uuid, uuid) TO authenticated, service_role;

-- 2) Recreate all policies that referenced public.is_admin / has_role / user_has_task_in_project
--    to use the private schema versions.

-- profiles
DROP POLICY IF EXISTS "Admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins update all profiles" ON public.profiles;
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (private.is_admin(auth.uid()));
CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE USING (private.is_admin(auth.uid()));

-- user_roles
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (private.is_admin(auth.uid()));

-- workflow_templates
DROP POLICY IF EXISTS "Admins manage templates" ON public.workflow_templates;
CREATE POLICY "Admins manage templates" ON public.workflow_templates FOR ALL USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- workflow_template_stages
DROP POLICY IF EXISTS "Admins manage template stages" ON public.workflow_template_stages;
CREATE POLICY "Admins manage template stages" ON public.workflow_template_stages FOR ALL USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- projects
DROP POLICY IF EXISTS "Admins view all projects" ON public.projects;
DROP POLICY IF EXISTS "Employees view assigned projects" ON public.projects;
DROP POLICY IF EXISTS "Admins manage projects" ON public.projects;
CREATE POLICY "Admins view all projects" ON public.projects FOR SELECT USING (private.is_admin(auth.uid()));
CREATE POLICY "Employees view assigned projects" ON public.projects FOR SELECT USING (private.user_has_task_in_project(auth.uid(), id));
CREATE POLICY "Admins manage projects" ON public.projects FOR ALL USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- project_stages
DROP POLICY IF EXISTS "Admins view all stages" ON public.project_stages;
DROP POLICY IF EXISTS "Employees view stages of their projects" ON public.project_stages;
DROP POLICY IF EXISTS "Admins manage stages" ON public.project_stages;
CREATE POLICY "Admins view all stages" ON public.project_stages FOR SELECT USING (private.is_admin(auth.uid()));
CREATE POLICY "Employees view stages of their projects" ON public.project_stages FOR SELECT USING (private.user_has_task_in_project(auth.uid(), project_id));
CREATE POLICY "Admins manage stages" ON public.project_stages FOR ALL USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- tasks
DROP POLICY IF EXISTS "Admins view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins manage tasks" ON public.tasks;
CREATE POLICY "Admins view all tasks" ON public.tasks FOR SELECT USING (private.is_admin(auth.uid()));
CREATE POLICY "Admins manage tasks" ON public.tasks FOR ALL USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

-- task_attachments
DROP POLICY IF EXISTS "Admins view all attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Assignee or admin upload attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Admins delete attachments" ON public.task_attachments;
CREATE POLICY "Admins view all attachments" ON public.task_attachments FOR SELECT USING (private.is_admin(auth.uid()));
CREATE POLICY "Assignee or admin upload attachments" ON public.task_attachments FOR INSERT WITH CHECK (
  (uploaded_by = auth.uid()) AND (private.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_attachments.task_id AND t.assignee_id = auth.uid()
  ))
);
CREATE POLICY "Admins delete attachments" ON public.task_attachments FOR DELETE USING (private.is_admin(auth.uid()));

-- task_comments
DROP POLICY IF EXISTS "Admins view all comments" ON public.task_comments;
DROP POLICY IF EXISTS "Author insert comments" ON public.task_comments;
CREATE POLICY "Admins view all comments" ON public.task_comments FOR SELECT USING (private.is_admin(auth.uid()));
CREATE POLICY "Author insert comments" ON public.task_comments FOR INSERT WITH CHECK (
  (author_id = auth.uid()) AND (private.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = task_comments.task_id AND t.assignee_id = auth.uid()
  ))
);

-- project_logs (also tighten INSERT — finding project_logs_unrestricted_insert)
DROP POLICY IF EXISTS "Admins view all logs" ON public.project_logs;
DROP POLICY IF EXISTS "Authenticated insert logs" ON public.project_logs;
CREATE POLICY "Admins view all logs" ON public.project_logs FOR SELECT USING (private.is_admin(auth.uid()));
CREATE POLICY "Related users insert logs" ON public.project_logs FOR INSERT WITH CHECK (
  actor_id = auth.uid()
  AND (private.is_admin(auth.uid()) OR private.user_has_task_in_project(auth.uid(), project_id))
);

-- blockers
DROP POLICY IF EXISTS "Admins view all blockers" ON public.blockers;
DROP POLICY IF EXISTS "Admins resolve blockers" ON public.blockers;
CREATE POLICY "Admins view all blockers" ON public.blockers FOR SELECT USING (private.is_admin(auth.uid()));
CREATE POLICY "Admins resolve blockers" ON public.blockers FOR UPDATE USING (private.is_admin(auth.uid()));

-- notifications_queue
DROP POLICY IF EXISTS "Admins view all notifications" ON public.notifications_queue;
CREATE POLICY "Admins view all notifications" ON public.notifications_queue FOR SELECT USING (private.is_admin(auth.uid()));

-- storage.objects (task-attachments)
DROP POLICY IF EXISTS "Admins all access task-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users read their own uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users upload to their task folder" ON storage.objects;
DROP POLICY IF EXISTS "Users delete their own uploads" ON storage.objects;

CREATE POLICY "Admins all access task-attachments" ON storage.objects FOR ALL
  USING (bucket_id = 'task-attachments' AND private.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'task-attachments' AND private.is_admin(auth.uid()));

-- Users may read a file only if it is registered in task_attachments AND
-- either they uploaded it OR they are the assignee of the linked task.
CREATE POLICY "Users read attachments for their tasks" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM public.task_attachments ta
      LEFT JOIN public.tasks t ON t.id = ta.task_id
      WHERE ta.file_path = storage.objects.name
        AND (ta.uploaded_by = auth.uid() OR t.assignee_id = auth.uid())
    )
  );

CREATE POLICY "Users upload to their task folder" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete their own uploads" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'task-attachments'
    AND EXISTS (
      SELECT 1 FROM public.task_attachments ta
      WHERE ta.file_path = storage.objects.name AND ta.uploaded_by = auth.uid()
    )
  );

-- 3) Now that no policies reference the public.* helpers, revoke their EXECUTE from
--    authenticated/anon so they aren't callable via PostgREST RPC.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_has_task_in_project(uuid, uuid) FROM PUBLIC, anon, authenticated;
