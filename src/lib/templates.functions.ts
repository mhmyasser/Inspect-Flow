import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const StageInput = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  stageType: z.enum(["progress", "informational"]),
  orderIndex: z.number().int().min(0),
  expectedDays: z.number().int().min(1).max(365),
  requiresAttachments: z.boolean(),
  requiresFinancial: z.boolean(),
});

export const upsertTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional().nullable(),
    projectType: z.enum(["tender", "direct"]),
    stages: z.array(StageInput).min(1),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: __adminRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle(); const isAdmin = !!__adminRow;
    if (!isAdmin) throw new Error("صلاحيات غير كافية");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let templateId = data.id;
    if (templateId) {
      const { error } = await supabaseAdmin.from("workflow_templates").update({
        name: data.name, description: data.description ?? null, project_type: data.projectType,
      }).eq("id", templateId);
      if (error) throw new Error(error.message);
      await supabaseAdmin.from("workflow_template_stages").delete().eq("template_id", templateId);
    } else {
      const { data: tpl, error } = await supabaseAdmin.from("workflow_templates").insert({
        name: data.name, description: data.description ?? null, project_type: data.projectType,
        created_by: context.userId,
      }).select("id").single();
      if (error) throw new Error(error.message);
      templateId = tpl.id;
    }
    await supabaseAdmin.from("workflow_template_stages").insert(
      data.stages.map((s) => ({
        template_id: templateId!,
        name: s.name,
        description: s.description ?? null,
        stage_type: s.stageType,
        order_index: s.orderIndex,
        expected_days: s.expectedDays,
        requires_attachments: s.requiresAttachments,
        requires_financial: s.requiresFinancial,
      }))
    );
    return { id: templateId };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: __adminRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle(); const isAdmin = !!__adminRow;
    if (!isAdmin) throw new Error("صلاحيات غير كافية");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("workflow_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
