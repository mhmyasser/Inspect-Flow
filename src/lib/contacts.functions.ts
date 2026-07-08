import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const searchContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    kind: z.enum(["customer", "supplier"]),
    query: z.string().max(200).default(""),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: adminRow } = await context.supabase.from("user_roles")
      .select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!adminRow) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("contacts")
      .select("id, name, company, email, phone")
      .eq("kind", data.kind)
      .order("name")
      .limit(10);
    const term = data.query.trim();
    if (term) q = q.ilike("name", `%${term}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
