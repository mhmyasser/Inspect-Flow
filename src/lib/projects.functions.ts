import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  clientName: z.string().max(200).optional().nullable(),
  customerName: z.string().max(200).optional().nullable(),
  customerId: z.string().uuid().optional().nullable(),
  supplierName: z.string().max(200).optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  projectType: z.enum(["tender", "direct"]),
  templateId: z.string().uuid().optional().nullable(),
  startDate: z.string(),
  expectedEndDate: z.string().optional().nullable(),
});

async function resolveContact(
  supabaseAdmin: typeof import("@/integrations/supabase/client.server")["supabaseAdmin"],
  kind: "customer" | "supplier",
  id: string | null | undefined,
  name: string | null | undefined,
  createdBy: string,
): Promise<string | null> {
  if (id) return id;
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  const { data: existing } = await supabaseAdmin.from("contacts")
    .select("id").eq("kind", kind).ilike("name", trimmed).limit(1).maybeSingle();
  if (existing) return existing.id;
  const { data: inserted, error } = await supabaseAdmin.from("contacts")
    .insert({ kind, name: trimmed, created_by: createdBy }).select("id").single();
  if (error) throw new Error(error.message);
  return inserted.id;
}

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateProjectSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: __adminRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle(); const isAdmin = !!__adminRow;
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
    const { dispatchWebhookEvent } = await import("@/lib/webhooks.server");
    await dispatchWebhookEvent("project.created", { id: project.id, name: project.name, type: data.projectType });
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
    const { data: __adminRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle(); const isAdmin = !!__adminRow;
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
    const { data: __adminRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle(); const isAdmin = !!__adminRow;
    if (!isAdmin) throw new Error("صلاحيات غير كافية");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const completedAt = data.status === "completed" ? new Date().toISOString() : null;
    const { data: stage, error } = await supabaseAdmin.from("project_stages")
      .update({ status: data.status, completed_at: completedAt })
      .eq("id", data.stageId).select("project_id, name").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("project_logs").insert({
      project_id: stage.project_id, actor_id: context.userId, action: "stage_status_changed",
      details: { stage: stage.name, new_status: data.status },
    });
    return { ok: true };
  });

export const addProjectStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    projectId: z.string().uuid(),
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    stageType: z.enum(["progress", "informational"]).default("progress"),
    expectedDays: z.number().int().min(1).max(365).default(3),
    deadline: z.string().optional().nullable(),
    requiresAttachments: z.boolean().default(false),
    requiresFinancial: z.boolean().default(false),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: __adminRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle(); const isAdmin = !!__adminRow;
    if (!isAdmin) throw new Error("صلاحيات غير كافية");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: maxRow } = await supabaseAdmin.from("project_stages")
      .select("order_index").eq("project_id", data.projectId)
      .order("order_index", { ascending: false }).limit(1).maybeSingle();
    const nextIdx = (maxRow?.order_index ?? 0) + 1;
    const { error } = await supabaseAdmin.from("project_stages").insert({
      project_id: data.projectId,
      name: data.name,
      description: data.description ?? null,
      stage_type: data.stageType,
      order_index: nextIdx,
      expected_days: data.expectedDays,
      deadline: data.deadline ?? null,
      requires_attachments: data.requiresAttachments,
      requires_financial: data.requiresFinancial,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("project_logs").insert({
      project_id: data.projectId, actor_id: context.userId, action: "stage_added",
      details: { name: data.name },
    });
    return { ok: true };
  });

export const deleteProjectStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ stageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: __adminRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle(); const isAdmin = !!__adminRow;
    if (!isAdmin) throw new Error("صلاحيات غير كافية");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: stage } = await supabaseAdmin.from("project_stages")
      .select("project_id, name").eq("id", data.stageId).single();
    await supabaseAdmin.from("tasks").delete().eq("stage_id", data.stageId);
    const { error } = await supabaseAdmin.from("project_stages").delete().eq("id", data.stageId);
    if (error) throw new Error(error.message);
    if (stage) {
      await supabaseAdmin.from("project_logs").insert({
        project_id: stage.project_id, actor_id: context.userId, action: "stage_deleted",
        details: { name: stage.name },
      });
    }
    return { ok: true };
  });

export const applyTemplateToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    projectId: z.string().uuid(),
    templateId: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: __adminRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle(); const isAdmin = !!__adminRow;
    if (!isAdmin) throw new Error("صلاحيات غير كافية");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: project } = await supabaseAdmin.from("projects")
      .select("start_date").eq("id", data.projectId).single();
    if (!project) throw new Error("المشروع غير موجود");
    const { data: existing } = await supabaseAdmin.from("project_stages")
      .select("order_index").eq("project_id", data.projectId)
      .order("order_index", { ascending: false }).limit(1).maybeSingle();
    let baseIdx = existing?.order_index ?? 0;
    const { data: tplStages } = await supabaseAdmin.from("workflow_template_stages")
      .select("*").eq("template_id", data.templateId).order("order_index");
    if (!tplStages?.length) throw new Error("القالب لا يحتوي مراحل");
    const startDate = new Date(project.start_date);
    let cumulative = 0;
    const rows = tplStages.map((s) => {
      cumulative += s.expected_days;
      baseIdx += 1;
      const deadline = new Date(startDate);
      deadline.setDate(deadline.getDate() + cumulative);
      return {
        project_id: data.projectId,
        name: s.name,
        description: s.description,
        stage_type: s.stage_type,
        order_index: baseIdx,
        expected_days: s.expected_days,
        requires_attachments: s.requires_attachments,
        requires_financial: s.requires_financial,
        deadline: deadline.toISOString(),
      };
    });
    const { error } = await supabaseAdmin.from("project_stages").insert(rows);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("project_logs").insert({
      project_id: data.projectId, actor_id: context.userId, action: "template_applied",
      details: { count: rows.length },
    });
    return { ok: true };
  });


export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: __adminRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle(); const isAdmin = !!__adminRow;
    if (!isAdmin) throw new Error("صلاحيات غير كافية");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Collect stage and task ids for cascading cleanup
    const { data: stages } = await supabaseAdmin.from("project_stages")
      .select("id").eq("project_id", data.projectId);
    const stageIds = (stages ?? []).map((s) => s.id);

    if (stageIds.length) {
      const { data: tasks } = await supabaseAdmin.from("tasks")
        .select("id").in("stage_id", stageIds);
      const taskIds = (tasks ?? []).map((t) => t.id);
      if (taskIds.length) {
        await supabaseAdmin.from("blockers").delete().in("task_id", taskIds);
        await supabaseAdmin.from("task_comments").delete().in("task_id", taskIds);
        await supabaseAdmin.from("task_attachments").delete().in("task_id", taskIds);
        await supabaseAdmin.from("notifications_queue").delete().in("related_task_id", taskIds);
        await supabaseAdmin.from("tasks").delete().in("id", taskIds);
      }
      await supabaseAdmin.from("project_stages").delete().in("id", stageIds);
    }
    await supabaseAdmin.from("notifications_queue").delete().eq("related_project_id", data.projectId);
    await supabaseAdmin.from("project_logs").delete().eq("project_id", data.projectId);
    const { error } = await supabaseAdmin.from("projects").delete().eq("id", data.projectId);
    if (error) throw new Error(error.message);
    const { dispatchWebhookEvent } = await import("@/lib/webhooks.server");
    await dispatchWebhookEvent("project.deleted", { id: data.projectId });
    return { ok: true };
  });
