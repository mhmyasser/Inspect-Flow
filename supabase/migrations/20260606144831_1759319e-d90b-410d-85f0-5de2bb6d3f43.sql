
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'employee');
CREATE TYPE public.project_type AS ENUM ('tender', 'direct');
CREATE TYPE public.project_status AS ENUM ('active', 'completed', 'cancelled', 'on_hold');
CREATE TYPE public.stage_type AS ENUM ('progress', 'informational');
CREATE TYPE public.stage_status AS ENUM ('pending', 'in_progress', 'completed', 'blocked');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'blocked', 'overdue');
CREATE TYPE public.notification_channel AS ENUM ('email', 'telegram');
CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'failed');
CREATE TYPE public.notification_kind AS ENUM ('task_assigned', 'task_reminder', 'task_overdue', 'task_escalation', 'blocker_reported');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  telegram_chat_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- helper functions (after user_roles exists)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin') $$;

-- auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data ->> 'phone'
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data ->> 'role')::public.app_role, 'employee'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- profiles RLS
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- user_roles RLS
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

-- WORKFLOW TEMPLATES
CREATE TABLE public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  project_type public.project_type NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_templates TO authenticated;
GRANT ALL ON public.workflow_templates TO service_role;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_wt_updated BEFORE UPDATE ON public.workflow_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "Authenticated view templates" ON public.workflow_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage templates" ON public.workflow_templates FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.workflow_template_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  stage_type public.stage_type NOT NULL DEFAULT 'progress',
  order_index INTEGER NOT NULL,
  expected_days INTEGER NOT NULL DEFAULT 3,
  requires_attachments BOOLEAN NOT NULL DEFAULT false,
  requires_financial BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_template_stages TO authenticated;
GRANT ALL ON public.workflow_template_stages TO service_role;
ALTER TABLE public.workflow_template_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view template stages" ON public.workflow_template_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage template stages" ON public.workflow_template_stages FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  project_type public.project_type NOT NULL,
  status public.project_status NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_end_date DATE,
  purchase_cost NUMERIC(14,2) DEFAULT 0,
  collected_amount NUMERIC(14,2) DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROJECT STAGES
CREATE TABLE public.project_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  stage_type public.stage_type NOT NULL DEFAULT 'progress',
  order_index INTEGER NOT NULL,
  status public.stage_status NOT NULL DEFAULT 'pending',
  expected_days INTEGER NOT NULL DEFAULT 3,
  deadline TIMESTAMPTZ,
  requires_attachments BOOLEAN NOT NULL DEFAULT false,
  requires_financial BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_stages TO authenticated;
GRANT ALL ON public.project_stages TO service_role;
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_ps_updated BEFORE UPDATE ON public.project_stages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TASKS
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES public.project_stages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES auth.users(id),
  status public.task_status NOT NULL DEFAULT 'pending',
  deadline TIMESTAMPTZ,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  last_reminder_sent_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- helper after tasks exists
CREATE OR REPLACE FUNCTION public.user_has_task_in_project(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.project_stages s ON s.id = t.stage_id
    WHERE s.project_id = _project_id AND t.assignee_id = _user_id
  )
$$;

-- projects RLS
CREATE POLICY "Admins view all projects" ON public.projects FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Employees view assigned projects" ON public.projects FOR SELECT TO authenticated USING (public.user_has_task_in_project(auth.uid(), id));
CREATE POLICY "Admins manage projects" ON public.projects FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- project_stages RLS
CREATE POLICY "Admins view all stages" ON public.project_stages FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Employees view stages of their projects" ON public.project_stages FOR SELECT TO authenticated USING (public.user_has_task_in_project(auth.uid(), project_id));
CREATE POLICY "Admins manage stages" ON public.project_stages FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- tasks RLS
CREATE POLICY "Admins view all tasks" ON public.tasks FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Employees view own tasks" ON public.tasks FOR SELECT TO authenticated USING (assignee_id = auth.uid());
CREATE POLICY "Admins manage tasks" ON public.tasks FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Employees update own task status" ON public.tasks FOR UPDATE TO authenticated USING (assignee_id = auth.uid()) WITH CHECK (assignee_id = auth.uid());

-- TASK ATTACHMENTS
CREATE TABLE public.task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all attachments" ON public.task_attachments FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Assignee view task attachments" ON public.task_attachments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
);
CREATE POLICY "Assignee or admin upload attachments" ON public.task_attachments FOR INSERT TO authenticated WITH CHECK (
  uploaded_by = auth.uid() AND (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
  )
);
CREATE POLICY "Admins delete attachments" ON public.task_attachments FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- TASK COMMENTS
CREATE TABLE public.task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all comments" ON public.task_comments FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Assignee view task comments" ON public.task_comments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
);
CREATE POLICY "Author insert comments" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (
  author_id = auth.uid() AND (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
  )
);

-- PROJECT LOGS
CREATE TABLE public.project_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.project_logs TO authenticated;
GRANT ALL ON public.project_logs TO service_role;
ALTER TABLE public.project_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all logs" ON public.project_logs FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Authenticated insert logs" ON public.project_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- BLOCKERS
CREATE TABLE public.blockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blockers TO authenticated;
GRANT ALL ON public.blockers TO service_role;
ALTER TABLE public.blockers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all blockers" ON public.blockers FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Reporter view own blockers" ON public.blockers FOR SELECT TO authenticated USING (reported_by = auth.uid());
CREATE POLICY "Assignee report blocker" ON public.blockers FOR INSERT TO authenticated WITH CHECK (
  reported_by = auth.uid() AND
  EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())
);
CREATE POLICY "Admins resolve blockers" ON public.blockers FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- NOTIFICATIONS QUEUE
CREATE TABLE public.notifications_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id),
  channel public.notification_channel NOT NULL,
  kind public.notification_kind NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  related_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  related_project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  status public.notification_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notifications_queue TO authenticated;
GRANT ALL ON public.notifications_queue TO service_role;
ALTER TABLE public.notifications_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view all notifications" ON public.notifications_queue FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Recipient view own notifications" ON public.notifications_queue FOR SELECT TO authenticated USING (recipient_user_id = auth.uid());

-- Indexes
CREATE INDEX idx_tasks_assignee ON public.tasks(assignee_id);
CREATE INDEX idx_tasks_stage ON public.tasks(stage_id);
CREATE INDEX idx_tasks_status_deadline ON public.tasks(status, deadline);
CREATE INDEX idx_stages_project ON public.project_stages(project_id);
CREATE INDEX idx_notif_status ON public.notifications_queue(status);
