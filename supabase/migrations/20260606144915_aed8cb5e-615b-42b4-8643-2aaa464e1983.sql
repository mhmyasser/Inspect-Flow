
CREATE POLICY "Admins all access task-attachments" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'task-attachments' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'task-attachments' AND public.is_admin(auth.uid()));

CREATE POLICY "Users upload to their task folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read their own uploads" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Seed default workflow templates
INSERT INTO public.workflow_templates (id, name, description, project_type, is_default)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'قالب المناقصة', 'مراحل المشروع بنظام المناقصة من كراسة الشروط حتى التحصيل', 'tender', true),
  ('22222222-2222-2222-2222-222222222222', 'قالب الأمر المباشر', 'مراحل المشروع المباشر من عرض السعر حتى التحصيل', 'direct', true);

INSERT INTO public.workflow_template_stages (template_id, name, description, stage_type, order_index, expected_days, requires_attachments, requires_financial) VALUES
  ('11111111-1111-1111-1111-111111111111', 'شراء كراسة الشروط', 'سداد ثمن كراسة الشروط واستلامها', 'progress', 1, 2, true, true),
  ('11111111-1111-1111-1111-111111111111', 'سداد التأمين الابتدائي', 'دفع التأمين الابتدائي للاشتراك في المناقصة', 'progress', 2, 3, true, true),
  ('11111111-1111-1111-1111-111111111111', 'إصدار عرض السعر', 'إعداد وتقديم عرض السعر للعميل', 'progress', 3, 5, true, false),
  ('11111111-1111-1111-1111-111111111111', 'الترسية وأمر التوريد', 'استلام إخطار الترسية وأمر التوريد من العميل', 'progress', 4, 7, true, false),
  ('11111111-1111-1111-1111-111111111111', 'شراء بنود العملية', 'شراء وتجهيز البنود المطلوبة', 'progress', 5, 10, true, true),
  ('11111111-1111-1111-1111-111111111111', 'التسليم ومحضر التسليم', 'تسليم البنود وإعداد محضر التسليم', 'progress', 6, 5, true, false),
  ('11111111-1111-1111-1111-111111111111', 'إصدار أمر الدفع', 'إصدار أمر الدفع من العميل', 'progress', 7, 7, true, false),
  ('11111111-1111-1111-1111-111111111111', 'التحصيل البنكي', 'تحصيل المستحقات في الحساب البنكي', 'progress', 8, 14, true, true);

INSERT INTO public.workflow_template_stages (template_id, name, description, stage_type, order_index, expected_days, requires_attachments, requires_financial) VALUES
  ('22222222-2222-2222-2222-222222222222', 'إصدار عرض السعر', 'إعداد وتقديم عرض السعر للعميل', 'progress', 1, 5, true, false),
  ('22222222-2222-2222-2222-222222222222', 'أمر التوريد', 'استلام أمر التوريد من العميل', 'progress', 2, 5, true, false),
  ('22222222-2222-2222-2222-222222222222', 'شراء بنود العملية', 'شراء وتجهيز البنود المطلوبة', 'progress', 3, 10, true, true),
  ('22222222-2222-2222-2222-222222222222', 'التسليم ومحضر التسليم', 'تسليم البنود وإعداد محضر التسليم', 'progress', 4, 5, true, false),
  ('22222222-2222-2222-2222-222222222222', 'إصدار أمر الدفع', 'إصدار أمر الدفع من العميل', 'progress', 5, 7, true, false),
  ('22222222-2222-2222-2222-222222222222', 'التحصيل البنكي', 'تحصيل المستحقات في الحساب البنكي', 'progress', 6, 14, true, true);
