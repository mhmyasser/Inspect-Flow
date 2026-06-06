import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CheckCircle2, AlertCircle, ListTodo } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-tasks")({
  component: MyTasksPage,
});

function MyTasksPage() {
  const { user } = useAuth();
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["my-tasks", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks").select("*").eq("assignee_id", user!.id)
        .order("deadline", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const now = new Date();
  const open = tasks?.filter((t) => t.status !== "completed" && !(t.deadline && new Date(t.deadline) < now && t.status !== "blocked")) ?? [];
  const overdue = tasks?.filter((t) => t.status !== "completed" && t.deadline && new Date(t.deadline) < now && t.status !== "blocked") ?? [];
  const completed = tasks?.filter((t) => t.status === "completed") ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">مهامي</h1>
        <p className="text-sm text-muted-foreground mt-1">المهام المسندة إليك</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : (
        <Tabs defaultValue="open">
          <TabsList>
            <TabsTrigger value="open">المفتوحة ({open.length})</TabsTrigger>
            <TabsTrigger value="overdue">متأخرة ({overdue.length})</TabsTrigger>
            <TabsTrigger value="completed">مكتملة ({completed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="open" className="mt-4"><TaskList list={open} /></TabsContent>
          <TabsContent value="overdue" className="mt-4"><TaskList list={overdue} overdue /></TabsContent>
          <TabsContent value="completed" className="mt-4"><TaskList list={completed} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function TaskList({ list, overdue }: { list: Array<{ id: string; title: string; status: string; deadline: string | null }>; overdue?: boolean }) {
  if (!list.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <ListTodo className="h-12 w-12 mx-auto mb-3 opacity-40" />
          لا توجد مهام هنا
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {list.map((t) => (
        <Link key={t.id} to="/tasks/$taskId" params={{ taskId: t.id }}>
          <Card className="hover:border-primary transition-colors">
            <CardContent className="pt-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <TaskIcon status={t.status} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{t.title}</div>
                  {t.deadline && (
                    <div className={`text-xs mt-1 ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
                      {overdue ? "متأخرة منذ " : "الموعد: "}
                      {new Date(t.deadline).toLocaleString("ar-EG")}
                    </div>
                  )}
                </div>
              </div>
              <StatusBadge status={t.status} />
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function TaskIcon({ status }: { status: string }) {
  const cls = "h-5 w-5 shrink-0";
  if (status === "completed") return <CheckCircle2 className={`${cls} text-success`} />;
  if (status === "blocked") return <AlertCircle className={`${cls} text-destructive`} />;
  return <Clock className={`${cls} text-warning`} />;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "جديدة", variant: "outline" },
    in_progress: { label: "قيد التنفيذ", variant: "default" },
    completed: { label: "مكتملة", variant: "secondary" },
    blocked: { label: "معطّلة", variant: "destructive" },
    overdue: { label: "متأخرة", variant: "destructive" },
  };
  const s = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant}>{s.label}</Badge>;
}
