// Server-only helper: dispatches events to registered webhooks.
import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { WebhookEvent } from "@/lib/webhooks.functions";

type WebhookRow = {
  id: string;
  url: string;
  events: string[];
  secret: string | null;
  active: boolean;
};

async function fetchMatchingWebhooks(event: WebhookEvent): Promise<WebhookRow[]> {
  const { data } = await supabaseAdmin
    .from("webhooks")
    .select("id, url, events, secret, active")
    .eq("active", true)
    .contains("events", [event]);
  return (data ?? []) as WebhookRow[];
}

export async function dispatchWebhookEvent(
  event: WebhookEvent,
  payload: Record<string, unknown>,
  hooksOverride?: WebhookRow[],
) {
  const hooks = hooksOverride ?? (await fetchMatchingWebhooks(event));
  if (hooks.length === 0) return;

  await Promise.all(
    hooks.map(async (hook) => {
      const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
      };
      if (hook.secret) {
        const sig = createHmac("sha256", hook.secret).update(body).digest("hex");
        headers["X-Webhook-Signature"] = sig;
      }
      let statusCode: number | null = null;
      let errorMsg: string | null = null;
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(8000),
        });
        statusCode = res.status;
        if (!res.ok) errorMsg = `HTTP ${res.status}`;
      } catch (e) {
        errorMsg = e instanceof Error ? e.message : String(e);
      }
      await supabaseAdmin.from("webhook_deliveries").insert({
        webhook_id: hook.id,
        event,
        payload: { event, payload },
        status_code: statusCode,
        error: errorMsg,
        delivered_at: new Date().toISOString(),
      });
    }),
  );
}
