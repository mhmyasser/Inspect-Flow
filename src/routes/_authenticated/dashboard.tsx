import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["dashboard-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status, project_type, start_date, expected_end_date")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: myTasks, isLoading: tasksLoading } = useQuery({
    queryKey: ["dashboard-my-tasks", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, deadline")
        .eq("assignee_id", user!.id)
        .neq("status", "completed")
        .order("deadline", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: blockers } = useQuery({
    queryKey: ["dashboard-blockers"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("blockers")
        .select("id, reason, task_id, created_at")
        .eq("resolved", false);
      if (error) throw error;
      return data;
    },
  });

  const overdueCount = myTasks?.filter(
    (t) => t.deadline && new Date(t.deadline) < new Date()
  ).length ?? 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? "نظرة عامة على المشاريع والموظفين" : "ملخص مهامك ومشاريعك"}
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link to="/projects/new"><Plus className="ms-2 h-4 w-4" /> مشروع جديد</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="إجمالي المشاريع"
          value={projectsLoading ? "—" : String(projects?.length ?? 0)}
          icon={FolderKanban}
          tone="primary"
        />
        <StatCard
          label="المشاريع النشطة"
          value={projectsLoading ? "—" : String(projects?.filter((p) => p.status === "active").length ?? 0)}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="مهامي المفتوحة"
          value={tasksLoading ? "—" : String(myTasks?.length ?? 0)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label={isAdmin ? "عوائق مفتوحة" : "مهامي المتأخرة"}
          value={isAdmin ? String(blockers?.length ?? 0) : String(overdueCount)}
          icon={AlertTriangle}
          tone="destructive"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">آخر المشاريع</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {projectsLoading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : projects?.length ? (
              projects.slice(0, 5).map((p) => (
                <Link
                  key={p.id}
                  to="/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-accent transition-colors"
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {p.project_type === "tender" ? "مناقصة" : "أمر مباشر"}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              ))
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">لا توجد مشاريع بعد</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">مهامي القادمة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {tasksLoading ? (
              <>
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </>
            ) : myTasks?.length ? (
              myTasks.slice(0, 5).map((t) => {
                const overdue = t.deadline && new Date(t.deadline) < new Date();
                return (
                  <Link
                    key={t.id}
                    to="/tasks/$taskId"
                    params={{ taskId: t.id }}
                    className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-accent transition-colors"
                  >
                    <div>
                      <div className="font-medium">{t.title}</div>
                      {t.deadline && (
                        <div className={`text-xs mt-1 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                          {overdue ? "متأخرة — " : "موعدها: "}
                          {new Date(t.deadline).toLocaleDateString("ar-EG")}
                        </div>
                      )}
                    </div>
                    {overdue && <Badge variant="destructive">متأخرة</Badge>}
                  </Link>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">لا توجد مهام مفتوحة</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: {
  label: string; value: string; icon: typeof FolderKanban;
  tone: "primary" | "success" | "warning" | "destructive";
}) {
  const colors = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="text-2xl font-bold mt-1">{value}</div>
          </div>
          <div className={`h-10 w-10 rounded-md flex items-center justify-center ${colors[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    active: { label: "نشط", variant: "default" },
    completed: { label: "مكتمل", variant: "secondary" },
    cancelled: { label: "ملغي", variant: "destructive" },
    on_hold: { label: "متوقف", variant: "outline" },
  };
  const s = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
