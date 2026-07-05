import { createFileRoute } from "@tanstack/react-router";

// Public endpoint called by pg_cron (or external cron) to:
// 1. Mark overdue tasks
// 2. Enqueue escalation notifications
// 3. Dispatch all pending notifications via Email + Telegram

export const Route = createFileRoute("/api/public/notifications/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const CRON_SECRET = process.env.CRON_SECRET;
        const incoming = request.headers.get("x-cron-secret");
        if (!CRON_SECRET || incoming !== CRON_SECRET) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();

        // 1) Mark overdue: any non-completed task past deadline
        const { data: justOverdue } = await supabaseAdmin
          .from("tasks")
          .select("id, title, assignee_id, deadline, escalated_at, last_reminder_sent_at, stage_id")
          .lt("deadline", now.toISOString())
          .neq("status", "completed")
          .neq("status", "blocked");

        const reminders: Array<Record<string, unknown>> = [];
        const escalations: Array<Record<string, unknown>> = [];
        const updateIds: string[] = [];

        // gather admins for escalation
        const { data: admins } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
        const adminIds = (admins ?? []).map((a) => a.user_id);

        for (const t of justOverdue ?? []) {
          if (!t.assignee_id || !t.deadline) continue;
          const deadline = new Date(t.deadline);
          const hoursPast = (now.getTime() - deadline.getTime()) / 36e5;
          // First reminder (overdue notice) — once per task
          if (!t.last_reminder_sent_at) {
            updateIds.push(t.id);
            reminders.push(
              { recipient_user_id: t.assignee_id, channel: "email", kind: "task_overdue",
                subject: "مهمتك متأخرة", body: `المهمة "${t.title}" تجاوزت موعدها النهائي. يرجى التحديث.`,
                related_task_id: t.id },
              { recipient_user_id: t.assignee_id, channel: "telegram", kind: "task_overdue",
                subject: "متأخر", body: `⏰ مهمتك متأخرة:\n${t.title}\nيرجى التحديث`,
                related_task_id: t.id },
            );
          }
          // Escalation after 24h
          if (hoursPast >= 24 && !t.escalated_at) {
            for (const aId of adminIds) {
              escalations.push(
                { recipient_user_id: aId, channel: "email", kind: "task_escalation",
                  subject: "تأخر موظف في تحديث مهمة",
                  body: `الموظف لم يحدّث المهمة "${t.title}" منذ أكثر من 24 ساعة بعد موعدها.`,
                  related_task_id: t.id },
                { recipient_user_id: aId, channel: "telegram", kind: "task_escalation",
                  subject: "تصعيد",
                  body: `🚨 تأخر موظف في المهمة:\n${t.title}`,
                  related_task_id: t.id },
              );
            }
            await supabaseAdmin.from("tasks").update({ escalated_at: now.toISOString() }).eq("id", t.id);
          }
        }

        if (updateIds.length) {
          await supabaseAdmin.from("tasks").update({ last_reminder_sent_at: now.toISOString() }).in("id", updateIds);
        }
        if (reminders.length) await supabaseAdmin.from("notifications_queue").insert(reminders as never);
        if (escalations.length) await supabaseAdmin.from("notifications_queue").insert(escalations as never);

        // 2) Dispatch pending notifications
        const { data: pending } = await supabaseAdmin
          .from("notifications_queue")
          .select("*")
          .eq("status", "pending")
          .lt("attempts", 5)
          .limit(50);

        let sent = 0, failed = 0;
        const RESEND_KEY = process.env.RESEND_API_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
        const FROM_EMAIL = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

        for (const n of pending ?? []) {
          try {
            const { data: profile } = await supabaseAdmin
              .from("profiles").select("email, telegram_chat_id, is_active").eq("id", n.recipient_user_id).single();
            if (!profile || !profile.is_active) {
              await supabaseAdmin.from("notifications_queue")
                .update({ status: "failed", last_error: "user inactive or missing", attempts: n.attempts + 1 })
                .eq("id", n.id);
              failed++;
              continue;
            }

            if (n.channel === "email") {
              if (!RESEND_KEY || !LOVABLE_API_KEY) {
                await supabaseAdmin.from("notifications_queue")
                  .update({ attempts: n.attempts + 1, last_error: "email not configured" })
                  .eq("id", n.id);
                failed++;
                continue;
              }
              const r = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                  "X-Connection-Api-Key": RESEND_KEY,
                },
                body: JSON.stringify({
                  from: FROM_EMAIL,
                  to: [profile.email],
                  subject: n.subject,
                  html: `<div dir="rtl" style="font-family:Arial,sans-serif"><p>${escapeHtml(n.body).replace(/\n/g, "<br>")}</p></div>`,
                }),

              });
              if (!r.ok) throw new Error(`resend ${r.status}: ${await r.text()}`);
            } else if (n.channel === "telegram") {
              if (!profile.telegram_chat_id) {
                await supabaseAdmin.from("notifications_queue")
                  .update({ status: "failed", last_error: "no telegram chat id", attempts: n.attempts + 1 })
                  .eq("id", n.id);
                failed++;
                continue;
              }
              if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) {
                await supabaseAdmin.from("notifications_queue")
                  .update({ attempts: n.attempts + 1, last_error: "telegram not configured" })
                  .eq("id", n.id);
                failed++;
                continue;
              }
              const r = await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                  "X-Connection-Api-Key": TELEGRAM_API_KEY,
                },
                body: JSON.stringify({ chat_id: profile.telegram_chat_id, text: n.body }),
              });
              if (!r.ok) throw new Error(`telegram ${r.status}: ${await r.text()}`);
            }

            await supabaseAdmin.from("notifications_queue")
              .update({ status: "sent", sent_at: now.toISOString(), attempts: n.attempts + 1 })
              .eq("id", n.id);
            sent++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            const nextAttempts = n.attempts + 1;
            await supabaseAdmin.from("notifications_queue")
              .update({
                status: nextAttempts >= 5 ? "failed" : "pending",
                attempts: nextAttempts,
                last_error: msg.slice(0, 500),
              })
              .eq("id", n.id);
            failed++;
          }
        }

        return Response.json({ ok: true, sent, failed, escalated: escalations.length / 2, reminded: reminders.length / 2 });
      },
    },
  },
});
