
DO $$ BEGIN
  CREATE TYPE public.contact_kind AS ENUM ('customer', 'supplier');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.contact_txn_kind AS ENUM ('invoice', 'payment', 'receipt', 'credit', 'debit', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind public.contact_kind NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  tax_id TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contacts" ON public.contacts
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.contact_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  kind public.contact_txn_kind NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_transactions TO authenticated;
GRANT ALL ON public.contact_transactions TO service_role;
ALTER TABLE public.contact_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contact transactions" ON public.contact_transactions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX idx_contact_txn_contact ON public.contact_transactions(contact_id);
CREATE INDEX idx_contact_txn_project ON public.contact_transactions(project_id);
CREATE TRIGGER update_contact_txn_updated_at
  BEFORE UPDATE ON public.contact_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.contact_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_attachments TO authenticated;
GRANT ALL ON public.contact_attachments TO service_role;
ALTER TABLE public.contact_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage contact attachments" ON public.contact_attachments
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));
CREATE INDEX idx_contact_attach_contact ON public.contact_attachments(contact_id);

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE POLICY "Admins read contact files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contact-attachments' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins upload contact files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contact-attachments' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins update contact files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contact-attachments' AND public.is_admin(auth.uid()));
CREATE POLICY "Admins delete contact files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contact-attachments' AND public.is_admin(auth.uid()));
