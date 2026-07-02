import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban, AlertTriangle, Clock, CheckCircle2, TrendingUp, ChevronDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type Project = { id: string; name: string; status: string; project_type: string; start_date: string | null; expected_end_date: string | null; created_at: string };
type Task = { id: string; title: string; status: string; deadline: string | null; assignee_id: string | null; created_at: string; completed_at: string | null };
type BlockerDetail = {
  id: string;
  reason: string;
  created_at: string;
  task: {
    id: string;
    title: string;
    stage: { id: string; name: string; project: { id: string; name: string } | null } | null;
  } | null;
};


const statusLabels: Record<string, string> = {
  active: "نشط", completed: "مكتمل", cancelled: "ملغي", on_hold: "متوقف",
  pending: "معلقة", in_progress: "جارية", blocked: "متوقفة",
};

const chartConfig = {
  count: { label: "العدد" },
  active: { label: "نشط", color: "var(--chart-1)" },
  completed: { label: "مكتمل", color: "var(--chart-2)" },
  on_hold: { label: "متوقف", color: "var(--chart-3)" },
  cancelled: { label: "ملغي", color: "var(--chart-5)" },
} satisfies ChartConfig;

function DashboardPage() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = role === "admin";

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["dashboard-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status, project_type, start_date, expected_end_date, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["dashboard-all-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, status, deadline, assignee_id, created_at, completed_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Task[];
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
      const { data, error } = await supabase.from("blockers")
        .select("id, reason, created_at, task:tasks!inner(id, title, stage:project_stages!inner(id, name, project:projects!inner(id, name)))")
        .eq("resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as BlockerDetail[];
    },
  });


  // Realtime refresh on data changes
  useEffect(() => {
    const ch = supabase.channel("dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard-all-tasks"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "projects" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard-projects"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "blockers" },
        () => queryClient.invalidateQueries({ queryKey: ["dashboard-blockers"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const overdueCount = myTasks?.filter(
    (t) => t.deadline && new Date(t.deadline) < new Date()
  ).length ?? 0;

  const projectStatusData = Object.entries(
    (projects ?? []).reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {}),
  ).map(([k, v]) => ({ name: statusLabels[k] ?? k, value: v, key: k }));

  const pieColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-5)", "var(--chart-4)"];

  const taskStatusData = Object.entries(
    (tasks ?? []).reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.status]: (acc[t.status] ?? 0) + 1 }), {}),
  ).map(([k, v]) => ({ status: statusLabels[k] ?? k, count: v }));

  // Last 14 days completion trend
  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const trendData = days.map((d) => {
    const completed = (tasks ?? []).filter((t) => t.completed_at && t.completed_at.slice(0, 10) === d).length;
    return { date: d.slice(5), completed };
  });

  const totalProjects = projects?.length ?? 0;
  const activeProjects = projects?.filter((p) => p.status === "active").length ?? 0;
  const totalTasks = tasks?.length ?? 0;
  const completedTasks = tasks?.filter((t) => t.status === "completed").length ?? 0;
  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const globalOverdue = (tasks ?? []).filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "completed").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">لوحة القيادة التنفيذية</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? "نظرة لحظية على أداء المشاريع والفرق" : "ملخص مهامك ومشاريعك"}
          </p>
        </div>
        {isAdmin && (
          <Button asChild>
            <Link to="/projects/new"><Plus className="ms-2 h-4 w-4" /> مشروع جديد</Link>
          </Button>
        )}
      </div>

      {/* Alerts */}
      {isAdmin && (globalOverdue > 0 || (blockers?.length ?? 0) > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {globalOverdue > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-md border border-destructive/40 bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div className="text-sm"><strong>{globalOverdue}</strong> مهمة متأخرة تحتاج تدخّلاً فورياً.</div>
            </div>
          )}
          {(blockers?.length ?? 0) > 0 && (
            <BlockersAlert blockers={blockers ?? []} />
          )}
        </div>
      )}


      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="إجمالي المشاريع" value={projectsLoading ? "—" : String(totalProjects)} icon={FolderKanban} tone="primary" />
        <StatCard label="المشاريع النشطة" value={String(activeProjects)} icon={Clock} tone="warning" />
        <StatCard label={isAdmin ? "معدل الإنجاز" : "مهامي المفتوحة"}
          value={isAdmin ? `${completionRate}%` : (tasksLoading ? "—" : String(myTasks?.length ?? 0))}
          icon={isAdmin ? TrendingUp : CheckCircle2} tone="success" />
        <StatCard label={isAdmin ? "مهام متأخرة" : "مهامي المتأخرة"}
          value={isAdmin ? String(globalOverdue) : String(overdueCount)}
          icon={AlertTriangle} tone="destructive" />
      </div>

      {/* Charts */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-base">توزيع المشاريع</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-56 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie data={projectStatusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {projectStatusData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">حالة المهام</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-56 w-full">
                <ResponsiveContainer>
                  <BarChart data={taskStatusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="status" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader><CardTitle className="text-base">اتجاه إنجاز المهام (آخر 14 يوماً)</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-56 w-full">
                <ResponsiveContainer>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="completed" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">آخر المشاريع</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {projectsLoading ? (<><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></>)
              : projects?.length ? projects.slice(0, 5).map((p) => (
                <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}
                  className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-accent transition-colors">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {p.project_type === "tender" ? "مناقصة" : "أمر مباشر"}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              )) : <p className="text-sm text-muted-foreground py-6 text-center">لا توجد مشاريع بعد</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">مهامي القادمة</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {tasksLoading ? (<><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></>)
              : myTasks?.length ? myTasks.slice(0, 5).map((t) => {
                const overdue = t.deadline && new Date(t.deadline) < new Date();
                return (
                  <Link key={t.id} to="/tasks/$taskId" params={{ taskId: t.id }}
                    className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-accent transition-colors">
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
              }) : <p className="text-sm text-muted-foreground py-6 text-center">لا توجد مهام مفتوحة</p>}
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
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
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
