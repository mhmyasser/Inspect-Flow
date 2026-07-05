import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "report_blocker",
  title: "Report a blocker",
  description:
    "Report a blocker on a task assigned to the signed-in user. Creates a blocker row and marks the task as blocked (subject to RLS).",
  inputSchema: {
    task_id: z.string().uuid().describe("Task ID the blocker relates to."),
    reason: z.string().min(3).max(2000).describe("Short description of the blocker."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ task_id, reason }, ctx) => {
    if (!ctx.isAuthenticated())
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("blockers")
      .insert({ task_id, reason, reported_by: ctx.getUserId(), resolved: false })
      .select("id, task_id, reason, created_at")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Blocker recorded (id ${data.id}).` }],
      structuredContent: { blocker: data },
    };
  },
});
