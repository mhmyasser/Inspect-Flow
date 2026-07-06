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
  id: z.string().uuid(),
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
      phone: data.phone ?? null,
      telegram_chat_id: data.telegramChatId ?? null,
      is_active: data.isActive,
    }).eq("id", data.id);
    if (pErr) throw new Error(pErr.message);
    // role replace
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: data.id, role: data.role });
    // ban/unban via auth admin
    await supabaseAdmin.auth.admin.updateUserById(data.id, {
      ban_duration: data.isActive ? "none" : "876000h",
    });
    return { ok: true };
  });

export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), newPassword: z.string().min(8).max(72) }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.newPassword });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
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
