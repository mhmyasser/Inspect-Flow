import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/setup/admin-exists")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { count, error } = await supabaseAdmin
          .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "admin");
        if (error) return Response.json({ exists: true });
        return Response.json({ exists: (count ?? 0) > 0 });
      },
    },
  },
});
