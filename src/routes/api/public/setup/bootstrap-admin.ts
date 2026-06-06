import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const BootstrapSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  fullName: z.string().min(1).max(100),
});

export const Route = createFileRoute("/api/public/setup/bootstrap-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Block if any admin already exists
        const { count, error: countErr } = await supabaseAdmin
          .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
        if (countErr) return Response.json({ error: countErr.message }, { status: 500 });
        if ((count ?? 0) > 0) {
          return Response.json({ error: "تم إنشاء حساب المدير بالفعل" }, { status: 403 });
        }
        let body: unknown;
        try { body = await request.json(); } catch { return Response.json({ error: "بيانات غير صالحة" }, { status: 400 }); }
        const parsed = BootstrapSchema.safeParse(body);
        if (!parsed.success) return Response.json({ error: "بيانات غير صالحة" }, { status: 400 });
        const { email, password, fullName } = parsed.data;

        const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName, role: "admin" },
        });
        if (error || !user.user) return Response.json({ error: error?.message ?? "فشل إنشاء المستخدم" }, { status: 500 });

        // Ensure admin role (trigger may set employee if metadata missed)
        await supabaseAdmin.from("user_roles").delete().eq("user_id", user.user.id);
        const { error: roleErr } = await supabaseAdmin.from("user_roles")
          .insert({ user_id: user.user.id, role: "admin" });
        if (roleErr) return Response.json({ error: roleErr.message }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
