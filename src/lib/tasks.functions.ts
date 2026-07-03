import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const CreateTaskSchema = z.object({
  stageId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  assigneeId: z.string().uuid(),
  deadline: z.string(),
});

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateTaskSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: __adminRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle(); const isAdmin = !!__adminRow;
    if (!isAdmin) throw new Error("صلاحيات غير كافية");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: task, error } = await supabaseAdmin.from("tasks").insert({
      stage_id: data.stageId,
      title: data.title,
      description: data.description ?? null,
      assignee_id: data.assigneeId,
      deadline: data.deadline,
      created_by: context.userId,
    }).select("id, stage_id").single();
    if (error) throw new Error(error.message);

    // Enqueue task_assigned notifications (email + telegram)
    await supabaseAdmin.from("notifications_queue").insert([
      {
        recipient_user_id: data.assigneeId, channel: "email", kind: "task_assigned",
        subject: "تم إسناد مهمة جديدة إليك",
        body: `تم إسناد مهمة "${data.title}" إليك. الموعد النهائي: ${new Date(data.deadline).toLocaleString("ar-EG")}`,
        related_task_id: task.id,
      },
      {
        recipient_user_id: data.assigneeId, channel: "telegram", kind: "task_assigned",
        subject: "مهمة جديدة",
        body: `📋 تم إسناد مهمة جديدة:\n\n${data.title}\n\n⏰ الموعد النهائي: ${new Date(data.deadline).toLocaleString("ar-EG")}`,
        related_task_id: task.id,
      },
    ]);

    // log
    const { data: stage } = await supabaseAdmin.from("project_stages").select("project_id, name").eq("id", data.stageId).single();
    if (stage) {
      await supabaseAdmin.from("project_logs").insert({
        project_id: stage.project_id, actor_id: context.userId, action: "task_assigned",
        details: { task: data.title, stage: stage.name },
      });
    }
    const { dispatchWebhookEvent } = await import("@/lib/webhooks.server");
    await dispatchWebhookEvent("task.created", { id: task.id, title: data.title, assigneeId: data.assigneeId, deadline: data.deadline });
    await dispatchWebhookEvent("task.assigned", { id: task.id, title: data.title, assigneeId: data.assigneeId });
    return { id: task.id };
  });

export const updateTaskStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    taskId: z.string().uuid(),
    status: z.enum(["pending", "in_progress", "completed", "blocked"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // RLS allows admin or assignee
    const completedAt = data.status === "completed" ? new Date().toISOString() : null;
    const startedAt = data.status === "in_progress" ? new Date().toISOString() : null;
    const updateData: { status: typeof data.status; completed_at?: string | null; started_at?: string | null } = {
      status: data.status,
      completed_at: completedAt,
    };
    if (startedAt) updateData.started_at = startedAt;
    const { data: task, error } = await supabase.from("tasks")
      .update(updateData).eq("id", data.taskId)
      .select("title, stage_id").single();
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: stage } = await supabaseAdmin.from("project_stages").select("project_id, name").eq("id", task.stage_id).single();
    if (stage) {
      await supabaseAdmin.from("project_logs").insert({
        project_id: stage.project_id, actor_id: userId, action: "task_status_changed",
        details: { task: task.title, new_status: data.status },
      });
    }
    const { dispatchWebhookEvent } = await import("@/lib/webhooks.server");
    await dispatchWebhookEvent("task.status_changed", { id: data.taskId, title: task.title, status: data.status });
    return { ok: true };
  });

export const addTaskComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    taskId: z.string().uuid(),
    content: z.string().min(1).max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("task_comments").insert({
      task_id: data.taskId, author_id: context.userId, content: data.content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reportBlocker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    taskId: z.string().uuid(), reason: z.string().min(5).max(2000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error: bErr } = await supabase.from("blockers").insert({
      task_id: data.taskId, reported_by: userId, reason: data.reason,
    });
    if (bErr) throw new Error(bErr.message);
    // Pause the task
    await supabase.from("tasks").update({ status: "blocked", paused_at: new Date().toISOString() }).eq("id", data.taskId);
    // Notify admins
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
    const { data: task } = await supabaseAdmin.from("tasks").select("title, stage_id").eq("id", data.taskId).single();
    const { data: reporter } = await supabaseAdmin.from("profiles").select("full_name").eq("id", userId).single();
    if (admins && task) {
      const rows = admins.flatMap((a) => ([
        {
          recipient_user_id: a.user_id, channel: "email" as const, kind: "blocker_reported" as const,
          subject: "تم الإبلاغ عن عائق",
          body: `أبلغ ${reporter?.full_name ?? "موظف"} عن عائق في المهمة "${task.title}":\n\n${data.reason}`,
          related_task_id: data.taskId,
        },
        {
          recipient_user_id: a.user_id, channel: "telegram" as const, kind: "blocker_reported" as const,
          subject: "عائق",
          body: `⚠️ عائق في مهمة:\n${task.title}\n\nالموظف: ${reporter?.full_name ?? ""}\nالسبب: ${data.reason}`,
          related_task_id: data.taskId,
        },
      ]));
      await supabaseAdmin.from("notifications_queue").insert(rows);
    }
    const { dispatchWebhookEvent } = await import("@/lib/webhooks.server");
    await dispatchWebhookEvent("task.blocked", { id: data.taskId, reason: data.reason });
    return { ok: true };
  });

export const resolveBlocker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    blockerId: z.string().uuid(),
    resolutionNote: z.string().max(2000).optional().nullable(),
    resumeTask: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: __adminRow } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!__adminRow) throw new Error("صلاحيات غير كافية");
    const { data: blocker, error } = await supabase.from("blockers").update({
      resolved: true,
      resolved_by: userId,
      resolved_at: new Date().toISOString(),
      resolution_note: data.resolutionNote ?? null,
    }).eq("id", data.blockerId).select("task_id").single();
    if (error) throw new Error(error.message);
    if (data.resumeTask && blocker?.task_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Check if any other open blockers remain
      const { count } = await supabaseAdmin.from("blockers")
        .select("id", { count: "exact", head: true })
        .eq("task_id", blocker.task_id).eq("resolved", false);
      if (!count) {
        await supabaseAdmin.from("tasks")
          .update({ status: "in_progress", paused_at: null })
          .eq("id", blocker.task_id);
      }
    }
    return { ok: true };
  });

export const reassignTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    taskId: z.string().uuid(),
    assigneeId: z.string().uuid(),
    deadline: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: __adminRow } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle(); const isAdmin = !!__adminRow;
    if (!isAdmin) throw new Error("صلاحيات غير كافية");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const update: { assignee_id: string; assigned_at: string; status: "pending"; deadline?: string } = {
      assignee_id: data.assigneeId,
      assigned_at: new Date().toISOString(),
      status: "pending",
    };
    if (data.deadline) update.deadline = data.deadline;
    const { data: task, error } = await supabaseAdmin.from("tasks").update(update).eq("id", data.taskId).select("title").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("notifications_queue").insert([
      { recipient_user_id: data.assigneeId, channel: "email", kind: "task_assigned",
        subject: "تم إسناد مهمة إليك", body: `تم إسناد مهمة "${task.title}" إليك.`, related_task_id: data.taskId },
      { recipient_user_id: data.assigneeId, channel: "telegram", kind: "task_assigned",
        subject: "مهمة", body: `📋 ${task.title}`, related_task_id: data.taskId },
    ]);
    const { dispatchWebhookEvent } = await import("@/lib/webhooks.server");
    await dispatchWebhookEvent("task.assigned", { id: data.taskId, title: task.title, assigneeId: data.assigneeId });
    return { ok: true };
  });
