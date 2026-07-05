import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listProjectsTool from "./tools/list-projects";
import listMyTasksTool from "./tools/list-my-tasks";
import reportBlockerTool from "./tools/report-blocker";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "work-wave-mcp",
  title: "Work Wave — Project Management",
  version: "0.1.0",
  instructions:
    "Tools for the Work Wave project management app. Use list_projects to see the user's projects, list_my_tasks to see tasks assigned to the signed-in user, and report_blocker to flag an issue on one of their tasks. All calls run as the authenticated user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listProjectsTool, listMyTasksTool, reportBlockerTool],
});
