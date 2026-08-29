import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function ensureAdmin(_supabase: any, userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) throw new Error("صلاحيات غير كافية");
}

const CreateEmployeeSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().min(1).max(100),
  phone: z.string().max(30).optional().nullable(),
  role: z.enum(["admin", "employee"]),
});

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateEmployeeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, phone: data.phone ?? null, role: data.role },
    });
    if (error || !user.user) throw new Error(error?.message ?? "فشل إنشاء الحساب");
    // Ensure correct role (trigger inserted default; reset to desired role)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", user.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: user.user.id, role: data.role });
    return { id: user.user.id };
  });

const UpdateEmployeeSchema = z.object({
  id: z.string().guid(),
  fullName: z.string().min(1).max(100),
  email: z.string().email().max(255),
  phone: z.string().max(30).optional().nullable(),
  telegramChatId: z.string().max(50).optional().nullable(),
  isActive: z.boolean(),
  role: z.enum(["admin", "employee"]),
});

export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateEmployeeSchema.parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: pErr } = await supabaseAdmin.from("profiles").update({
      full_name: data.fullName,
      email: data.email,
      phone: data.phone ?? null,
      telegram_chat_id: data.telegramChatId ?? null,
      is_active: data.isActive,
    }).eq("id", data.id);
    if (pErr) throw new Error(pErr.message);
    // role replace
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role });
    // update email + ban/unban via auth admin
    await supabaseAdmin.auth.admin.updateUserById(data.id, {
      email: data.email,
      ban_duration: data.isActive ? "none" : "876000h",
    });
    return { ok: true };
  });

export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().guid(), newPassword: z.string().min(8).max(72) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.newPassword });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().guid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("لا يمكنك حذف حسابك");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Unassign open tasks
    await supabaseAdmin.from("tasks").update({ assignee_id: null }).eq("assignee_id", data.id).neq("status", "completed");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, telegram_chat_id, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, "admin" | "employee">();
    roles?.forEach((r) => {
      const existing = roleMap.get(r.user_id);
      if (r.role === "admin" || !existing) roleMap.set(r.user_id, r.role as "admin" | "employee");
    });
    return profiles.map((p) => ({ ...p, role: roleMap.get(p.id) ?? "employee" }));
  });

export const getEmployeePerformance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().guid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone, telegram_chat_id, is_active, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error("الموظف غير موجود");

    const { data: roleRow } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.id);
    const role = roleRow?.some((r) => r.role === "admin") ? "admin" : "employee";

    const { data: tasks, error: tErr } = await supabaseAdmin
      .from("tasks")
      .select("id, title, status, deadline, assigned_at, started_at, completed_at, stage_id, project_stages(id, name, project_id, projects(id, name))")
      .eq("assignee_id", data.id)
      .order("deadline", { ascending: true, nullsFirst: false });
    if (tErr) throw new Error(tErr.message);

    const { data: blockers } = await supabaseAdmin
      .from("blockers")
      .select("id, reason, resolved, created_at, task_id")
      .eq("reported_by", data.id)
      .order("created_at", { ascending: false });

    const now = Date.now();
    const rows = (tasks ?? []).map((t: any) => {
      const stage = t.project_stages ?? null;
      const project = stage?.projects ?? null;
      const deadline = t.deadline ? new Date(t.deadline).getTime() : null;
      const completedAt = t.completed_at ? new Date(t.completed_at).getTime() : null;
      const isCompleted = t.status === "completed";
      const onTime = isCompleted && deadline != null && completedAt != null ? completedAt <= deadline : null;
      const lateMs = isCompleted
        ? (deadline != null && completedAt != null ? Math.max(0, completedAt - deadline) : 0)
        : (deadline != null && deadline < now ? now - deadline : 0);
      const durationMs = completedAt != null ? completedAt - new Date(t.assigned_at).getTime() : null;
      return {
        id: t.id,
        title: t.title,
        status: t.status as string,
        deadline: t.deadline as string | null,
        assigned_at: t.assigned_at as string,
        started_at: t.started_at as string | null,
        completed_at: t.completed_at as string | null,
        stage_name: stage?.name ?? null,
        project_id: project?.id ?? null,
        project_name: project?.name ?? null,
        is_overdue: !isCompleted && deadline != null && deadline < now,
        on_time: onTime,
        late_days: lateMs > 0 ? Math.round(lateMs / 86400000) : 0,
        duration_days: durationMs != null ? Math.round(durationMs / 86400000) : null,
      };
    });

    const total = rows.length;
    const completed = rows.filter((r) => r.status === "completed");
    const overdue = rows.filter((r) => r.is_overdue);
    const inProgress = rows.filter((r) => r.status === "in_progress");
    const pending = rows.filter((r) => r.status === "pending");
    const blocked = rows.filter((r) => r.status === "blocked");
    const withDeadline = completed.filter((r) => r.on_time !== null);
    const onTimeCount = withDeadline.filter((r) => r.on_time === true).length;
    const onTimeRate = withDeadline.length ? Math.round((onTimeCount / withDeadline.length) * 100) : null;
    const completionRate = total ? Math.round((completed.length / total) * 100) : 0;
    const durations = completed.map((r) => r.duration_days).filter((d): d is number => d != null);
    const avgDurationDays = durations.length
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : null;
    const avgLateDays = completed.length
      ? Math.round((completed.reduce((a, r) => a + r.late_days, 0) / completed.length) * 10) / 10
      : null;

    // Score: 60% on-time commitment, 30% completion, -penalty for open overdue
    const punctuality = onTimeRate ?? (overdue.length ? 40 : 70);
    const overduePenalty = total ? Math.min(25, Math.round((overdue.length / total) * 100 * 0.5)) : 0;
    const score = Math.max(0, Math.min(100, Math.round(punctuality * 0.6 + completionRate * 0.4 - overduePenalty)));
    const grade = score >= 85 ? "ممتاز" : score >= 70 ? "جيد جداً" : score >= 55 ? "جيد" : score >= 40 ? "مقبول" : "يحتاج تحسين";

    const projectsMap = new Map<string, { id: string; name: string; total: number; completed: number }>();
    rows.forEach((r) => {
      if (!r.project_id) return;
      const entry = projectsMap.get(r.project_id) ?? { id: r.project_id, name: r.project_name ?? "—", total: 0, completed: 0 };
      entry.total += 1;
      if (r.status === "completed") entry.completed += 1;
      projectsMap.set(r.project_id, entry);
    });

    return {
      profile: { ...profile, role },
      tasks: rows,
      blockers: blockers ?? [],
      projects: Array.from(projectsMap.values()).sort((a, b) => b.total - a.total),
      kpi: {
        total,
        completed: completed.length,
        inProgress: inProgress.length,
        pending: pending.length,
        blocked: blocked.length,
        overdue: overdue.length,
        completionRate,
        onTimeRate,
        avgDurationDays,
        avgLateDays,
        blockersReported: (blockers ?? []).length,
        unresolvedBlockers: (blockers ?? []).filter((b) => !b.resolved).length,
        score,
        grade,
      },
    };
  });
