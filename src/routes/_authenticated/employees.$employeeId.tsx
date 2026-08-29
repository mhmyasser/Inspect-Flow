import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getEmployeePerformance } from "@/lib/employees.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import {
  ArrowRight, CheckCircle2, Clock, AlertTriangle, ListTodo, Timer, Ban, Gauge,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/employees/$employeeId")({
  head: () => ({
    meta: [
      { title: "ملف أداء الموظف — إدارة المشاريع التجارية" },
      { name: "description", content: "مؤشرات أداء الموظف ومهامه المسندة والتزامه بالمواعيد النهائية." },
      { property: "og:title", content: "ملف أداء الموظف — إدارة المشاريع التجارية" },
      { property: "og:description", content: "مؤشرات أداء الموظف ومهامه المسندة والتزامه بالمواعيد النهائية." },
      { name: "twitter:title", content: "ملف أداء الموظف — إدارة المشاريع التجارية" },
      { name: "twitter:description", content: "مؤشرات أداء الموظف ومهامه المسندة والتزامه بالمواعيد النهائية." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EmployeeDetailPage,
});

const statusLabel: Record<string, string> = {
  pending: "قيد الانتظار",
  in_progress: "قيد التنفيذ",
  completed: "مكتملة",
  blocked: "متوقفة",
  overdue: "متأخرة",
};

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

function EmployeeDetailPage() {
  const { employeeId } = Route.useParams();
  const { role, loading } = useAuth();
  const navigate = useNavigate();
  const fetchPerf = useServerFn(getEmployeePerformance);

  useEffect(() => {
    if (!loading && role && role !== "admin") navigate({ to: "/dashboard", replace: true });
  }, [role, loading, navigate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["employee-performance", employeeId],
    queryFn: () => fetchPerf({ data: { id: employeeId } }),
    enabled: role === "admin",
  });

  if (isLoading || !role) return <p className="text-muted-foreground">جاري التحميل...</p>;
  if (error) return <p className="text-destructive">{(error as Error).message}</p>;
  if (!data) return null;

  const { profile, kpi, tasks, projects, blockers } = data;
  const open = tasks.filter((t) => t.status !== "completed");
  const completed = tasks.filter((t) => t.status === "completed");
  const overdue = tasks.filter((t) => t.is_overdue);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Button asChild variant="ghost" size="sm" className="gap-2">
        <Link to="/employees"><ArrowRight className="h-4 w-4" /> رجوع لقائمة الموظفين</Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{profile.full_name}</h1>
          <p className="text-sm text-muted-foreground mt-1" dir="ltr">{profile.email}</p>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
              {profile.role === "admin" ? "مدير" : "موظف"}
            </Badge>
            {!profile.is_active && <Badge variant="destructive">معطّل</Badge>}
            {profile.phone && <span className="text-xs text-muted-foreground" dir="ltr">{profile.phone}</span>}
          </div>
        </div>
        <Card className="min-w-[220px]">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs mb-1">
              <Gauge className="h-4 w-4" /> تقييم الأداء العام
            </div>
            <div className="text-4xl font-bold">{kpi.score}<span className="text-base text-muted-foreground">/100</span></div>
            <div className="text-sm font-medium mt-1">{kpi.grade}</div>
            <Progress value={kpi.score} className="mt-3" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Kpi icon={ListTodo} label="إجمالي المهام" value={kpi.total} />
        <Kpi icon={CheckCircle2} label="مهام مكتملة" value={`${kpi.completed} (${kpi.completionRate}%)`} />
        <Kpi icon={Clock} label="الالتزام بالمواعيد" value={kpi.onTimeRate === null ? "—" : `${kpi.onTimeRate}%`} />
        <Kpi icon={AlertTriangle} label="مهام متأخرة" value={kpi.overdue} danger={kpi.overdue > 0} />
        <Kpi icon={Timer} label="متوسط زمن الإنجاز" value={kpi.avgDurationDays === null ? "—" : `${kpi.avgDurationDays} يوم`} />
        <Kpi icon={Timer} label="متوسط التأخير" value={kpi.avgLateDays === null ? "—" : `${kpi.avgLateDays} يوم`} />
        <Kpi icon={Clock} label="قيد التنفيذ" value={kpi.inProgress} />
        <Kpi icon={Ban} label="عوائق غير محلولة" value={kpi.unresolvedBlockers} danger={kpi.unresolvedBlockers > 0} />
      </div>

      {projects.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">المشاركة في المشاريع</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <Link to="/projects/$projectId" params={{ projectId: p.id }} className="text-sm hover:underline flex-1 min-w-0 truncate">
                  {p.name}
                </Link>
                <span className="text-xs text-muted-foreground">{p.completed}/{p.total}</span>
                <Progress value={p.total ? (p.completed / p.total) * 100 : 0} className="w-28" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="open">
        <TabsList>
          <TabsTrigger value="open">مفتوحة ({open.length})</TabsTrigger>
          <TabsTrigger value="overdue">متأخرة ({overdue.length})</TabsTrigger>
          <TabsTrigger value="completed">مكتملة ({completed.length})</TabsTrigger>
          <TabsTrigger value="blockers">العوائق ({blockers.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="mt-4"><TaskTable rows={open} /></TabsContent>
        <TabsContent value="overdue" className="mt-4"><TaskTable rows={overdue} /></TabsContent>
        <TabsContent value="completed" className="mt-4"><TaskTable rows={completed} /></TabsContent>
        <TabsContent value="blockers" className="mt-4">
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {!blockers.length ? (
                <div className="p-6 text-center text-muted-foreground text-sm">لا توجد عوائق مسجّلة</div>
              ) : blockers.map((b) => (
                <Link key={b.id} to="/tasks/$taskId" params={{ taskId: b.task_id }} className="block p-4 hover:bg-muted/40">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={b.resolved ? "secondary" : "destructive"}>{b.resolved ? "تم الحل" : "نشط"}</Badge>
                    <span className="text-xs text-muted-foreground">{fmt(b.created_at)}</span>
                  </div>
                  <p className="text-sm mt-1">{b.reason}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, danger }: { icon: any; label: string; value: string | number; danger?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className={`h-4 w-4 ${danger ? "text-destructive" : ""}`} /> {label}
        </div>
        <div className={`text-xl font-bold mt-2 ${danger ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

type Row = ReturnType<typeof Object> extends never ? never : any;

function TaskTable({ rows }: { rows: Row[] }) {
  if (!rows.length) {
    return (
      <Card><CardContent className="p-6 text-center text-muted-foreground text-sm">لا توجد مهام</CardContent></Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0 divide-y divide-border">
        {rows.map((t) => (
          <Link key={t.id} to="/tasks/$taskId" params={{ taskId: t.id }} className="block p-4 hover:bg-muted/40">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium flex-1 min-w-0 truncate">{t.title}</span>
              <Badge variant={t.status === "completed" ? "secondary" : t.is_overdue ? "destructive" : "outline"}>
                {t.is_overdue && t.status !== "completed" ? "متأخرة" : statusLabel[t.status] ?? t.status}
              </Badge>
              {t.status === "completed" && t.on_time !== null && (
                <Badge variant={t.on_time ? "default" : "destructive"}>
                  {t.on_time ? "في الموعد" : `تأخير ${t.late_days} يوم`}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {t.project_name && <span>المشروع: {t.project_name}</span>}
              {t.stage_name && <span>المرحلة: {t.stage_name}</span>}
              <span>الموعد النهائي: {fmt(t.deadline)}</span>
              {t.completed_at && <span>أُنجزت: {fmt(t.completed_at)}</span>}
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
