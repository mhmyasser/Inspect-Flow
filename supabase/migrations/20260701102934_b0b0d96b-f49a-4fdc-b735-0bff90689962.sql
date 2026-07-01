
-- ================= NOTIFICATIONS =================
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  link text,
  kind text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
-- No INSERT policy for authenticated → only service_role/triggers insert

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- ================= WEBHOOKS =================
CREATE TABLE public.webhooks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.webhooks TO authenticated;
GRANT ALL ON public.webhooks TO service_role;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage webhooks" ON public.webhooks
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_webhooks_updated
  BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================= WEBHOOK DELIVERIES =================
CREATE TABLE public.webhook_deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload jsonb NOT NULL,
  status_code int,
  error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_deliveries_webhook_created ON public.webhook_deliveries(webhook_id, created_at DESC);
GRANT SELECT, INSERT ON public.webhook_deliveries TO authenticated;
GRANT ALL ON public.webhook_deliveries TO service_role;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view deliveries" ON public.webhook_deliveries
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ================= TASK ASSIGNMENT NOTIFICATION =================
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  should_notify boolean := false;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.assignee_id IS NOT NULL THEN
    should_notify := true;
  ELSIF TG_OP = 'UPDATE' AND NEW.assignee_id IS NOT NULL
        AND NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    should_notify := true;
  END IF;

  IF should_notify THEN
    INSERT INTO public.notifications (user_id, title, body, link, kind)
    VALUES (
      NEW.assignee_id,
      'تم إسناد مهمة جديدة إليك',
      COALESCE(NEW.title, 'مهمة'),
      '/tasks/' || NEW.id::text,
      'task_assigned'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_assignment ON public.tasks;
CREATE TRIGGER trg_notify_task_assignment
  AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assignment();
