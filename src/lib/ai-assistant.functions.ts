import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const AskSchema = z.object({
  question: z.string().min(2).max(2000),
});

type ProjectRow = { id: string; name: string; status: string; project_type: string; start_date: string | null; expected_end_date: string | null; created_at: string };
type TaskRow = { id: string; title: string; status: string; deadline: string | null; assignee_id: string | null };
type BlockerRow = { id: string; reason: string; resolved: boolean; created_at: string };

async function buildOperationalContext() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: projects }, { data: tasks }, { data: blockers }, { data: profiles }] = await Promise.all([
    supabaseAdmin.from("projects").select("id, name, status, project_type, start_date, expected_end_date, created_at").limit(50),
    supabaseAdmin.from("tasks").select("id, title, status, deadline, assignee_id").limit(200),
    supabaseAdmin.from("blockers").select("id, reason, resolved, created_at").limit(50),
    supabaseAdmin.from("profiles").select("id, full_name").limit(100),
  ]);

  const now = Date.now();
  const p = (projects ?? []) as ProjectRow[];
  const t = (tasks ?? []) as TaskRow[];
  const b = (blockers ?? []) as BlockerRow[];
  const nameMap = new Map((profiles ?? []).map((x) => [x.id as string, x.full_name as string]));

  const overdue = t.filter((x) => x.deadline && new Date(x.deadline).getTime() < now && x.status !== "completed");
  const byStatus = (arr: { status: string }[]) =>
    arr.reduce<Record<string, number>>((acc, x) => ({ ...acc, [x.status]: (acc[x.status] ?? 0) + 1 }), {});

  return {
    generated_at: new Date().toISOString(),
    projects: { total: p.length, by_status: byStatus(p), recent: p.slice(0, 10).map((x) => ({ name: x.name, status: x.status, type: x.project_type, expected_end_date: x.expected_end_date })) },
    tasks: {
      total: t.length,
      by_status: byStatus(t),
      overdue_count: overdue.length,
      overdue_sample: overdue.slice(0, 10).map((x) => ({ title: x.title, deadline: x.deadline, assignee: x.assignee_id ? nameMap.get(x.assignee_id) ?? "—" : "—" })),
    },
    blockers: { open: b.filter((x) => !x.resolved).length, sample: b.filter((x) => !x.resolved).slice(0, 5).map((x) => x.reason) },
  };
}

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AskSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Admin-only: this endpoint reads across-tenant data via the admin client.
    const { data: adminRow, error: adminErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (adminErr || !adminRow) throw new Error("صلاحيات غير كافية");

    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("مفتاح المساعد الذكي غير مضبوط.");

    const ctx = await buildOperationalContext();
    const system = [
      "أنت مساعد تشغيلي ذكي داخل نظام إدارة مشاريع تجارية باللغة العربية.",
      "استخدم البيانات الحقيقية المرفقة (JSON) للإجابة، ولا تختلق أرقاماً غير موجودة.",
      "قدّم إجابات مختصرة ومنظّمة بنقاط، واقترح إجراءات عملية للمدير مثل إعادة توزيع المهام أو تصعيد العوائق.",
      "إذا كانت البيانات لا تكفي، اطلب من المستخدم توضيحاً محدداً.",
    ].join("\n");

    const userContent = `بيانات النظام الحالية:\n\`\`\`json\n${JSON.stringify(ctx, null, 2)}\n\`\`\`\n\nسؤال المستخدم: ${data.question}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("تم تجاوز الحد المسموح، حاول لاحقاً.");
      if (res.status === 402) throw new Error("رصيد المساعد الذكي منتهي. الرجاء ترقية الخطة.");
      throw new Error(`فشل الاتصال بالمساعد: ${txt.slice(0, 200)}`);
    }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const answer = json.choices?.[0]?.message?.content ?? "لم أستطع توليد إجابة.";
    return { answer };
  });
