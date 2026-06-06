import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  clientName: z.string().max(200).optional().nullable(),
  projectType: z.enum(["tender", "direct"]),
  templateId: z.string().uuid().optional().nullable(),
  startDate: z.string(),
  expectedEndDate: z.string().optional().nullable(),
});

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateProjectSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("صلاحيات غير كافية");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: project, error } = await supabaseAdmin.from("projects").insert({
      name: data.name,
      description: data.description ?? null,
      client_name: data.clientName ?? null,
      project_type: data.projectType,
      start_date: data.startDate,
      expected_end_date: data.expectedEndDate ?? null,
      created_by: context.userId,
    }).select().single();
    if (error) throw new Error(error.message);

    // Copy stages from template
    if (data.templateId) {
      const { data: tplStages } = await supabaseAdmin
        .from("workflow_template_stages")
        .select("*")
        .eq("template_id", data.templateId)
        .order("order_index");

      if (tplStages?.length) {
        const startDate = new Date(data.startDate);
        let cumulative = 0;
        const rows = tplStages.map((s) => {
          cumulative += s.expected_days;
          const deadline = new Date(startDate);
          deadline.setDate(deadline.getDate() + cumulative);
          return {
            project_id: project.id,
            name: s.name,
            description: s.description,
            stage_type: s.stage_type,
            order_index: s.order_index,
            expected_days: s.expected_days,
            requires_attachments: s.requires_attachments,
            requires_financial: s.requires_financial,
            deadline: deadline.toISOString(),
          };
        });
        await supabaseAdmin.from("project_stages").insert(rows);
      }
    }

    await supabaseAdmin.from("project_logs").insert({
      project_id: project.id, actor_id: context.userId, action: "project_created",
      details: { name: project.name },
    });
    return { id: project.id };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    clientName: z.string().max(200).optional().nullable(),
    status: z.enum(["active", "completed", "cancelled", "on_hold"]),
    expectedEndDate: z.string().optional().nullable(),
    purchaseCost: z.number().min(0).default(0),
    collectedAmount: z.number().min(0).default(0),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("صلاحيات غير كافية");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("projects").update({
      name: data.name,
      description: data.description ?? null,
      client_name: data.clientName ?? null,
      status: data.status,
      expected_end_date: data.expectedEndDate ?? null,
      purchase_cost: data.purchaseCost,
      collected_amount: data.collectedAmount,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("project_logs").insert({
      project_id: data.id, actor_id: context.userId, action: "project_updated",
    });
    return { ok: true };
  });

export const updateStageStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    stageId: z.string().uuid(),
    status: z.enum(["pending", "in_progress", "completed", "blocked"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("صلاحيات غير كافية");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const update: Record<string, unknown> = { status: data.status };
    if (data.status === "completed") update.completed_at = new Date().toISOString();
    const { data: stage, error } = await supabaseAdmin.from("project_stages")
      .update(update).eq("id", data.stageId).select("project_id, name").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("project_logs").insert({
      project_id: stage.project_id, actor_id: context.userId, action: "stage_status_changed",
      details: { stage: stage.name, new_status: data.status },
    });
    return { ok: true };
  });
