-- Point remaining policies at the private (non-API) helper functions
DROP POLICY IF EXISTS "Admins manage webhooks" ON public.webhooks;
CREATE POLICY "Admins manage webhooks" ON public.webhooks FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins view deliveries" ON public.webhook_deliveries;
CREATE POLICY "Admins view deliveries" ON public.webhook_deliveries FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins manage contacts" ON public.contacts;
CREATE POLICY "Admins manage contacts" ON public.contacts FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage contact transactions" ON public.contact_transactions;
CREATE POLICY "Admins manage contact transactions" ON public.contact_transactions FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins manage contact attachments" ON public.contact_attachments;
CREATE POLICY "Admins manage contact attachments" ON public.contact_attachments FOR ALL TO authenticated
  USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins read contact files" ON storage.objects;
CREATE POLICY "Admins read contact files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contact-attachments' AND private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins upload contact files" ON storage.objects;
CREATE POLICY "Admins upload contact files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contact-attachments' AND private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update contact files" ON storage.objects;
CREATE POLICY "Admins update contact files" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contact-attachments' AND private.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete contact files" ON storage.objects;
CREATE POLICY "Admins delete contact files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contact-attachments' AND private.is_admin(auth.uid()));

-- Remove the API-exposed SECURITY DEFINER wrappers from signed-in users
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_has_task_in_project(uuid, uuid) FROM PUBLIC, anon, authenticated;