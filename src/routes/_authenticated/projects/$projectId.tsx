import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { updateProject, updateStageStatus, addProjectStage, deleteProjectStage, applyTemplateToProject, deleteProject } from "@/lib/projects.functions";
import { createTask } from "@/lib/tasks.functions";
import { listEmployees } from "@/lib/employees.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { CheckCircle2, Circle, Clock, AlertCircle, Plus, ArrowLeft, Loader2, UserPlus, Trash2, LayoutTemplate } from "lucide-react";


export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = Route.useParams();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: stages } = useQuery({
    queryKey: ["project-stages", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_stages").select("*").eq("project_id", projectId).order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ["project-tasks", projectId],
    enabled: !!stages?.length,
    queryFn: async () => {
      const stageIds = stages!.map((s) => s.id);
      const { data, error } = await supabase
        .from("tasks").select("*").in("stage_id", stageIds).order("created_at");
      if (error) throw error;
      const assigneeIds = Array.from(new Set(data.map((t) => t.assignee_id).filter((x): x is string => !!x)));
      const { data: profiles } = assigneeIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", assigneeIds)
        : { data: [] as { id: string; full_name: string }[] };
      const map = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      return data.map((t) => ({ ...t, assignee_name: t.assignee_id ? map.get(t.assignee_id) ?? null : null }));
    },
  });

  const { data: taskBlockers } = useQuery({
    queryKey: ["project-task-blockers", projectId],
    enabled: !!tasks?.length,
    queryFn: async () => {
      const taskIds = tasks!.map((t) => t.id);
      const { data, error } = await supabase.from("blockers")
        .select("id, task_id, reason, resolved, created_at, reported_by")
        .in("task_id", taskIds).eq("resolved", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set(data.map((b) => b.reported_by).filter((x): x is string => !!x)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as { id: string; full_name: string }[] };
      const nameMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      const byTask = new Map<string, { id: string; reason: string; created_at: string; reporter_name: string | null }[]>();
      for (const b of data) {
        const arr = byTask.get(b.task_id) ?? [];
        arr.push({ id: b.id, reason: b.reason, created_at: b.created_at, reporter_name: b.reported_by ? nameMap.get(b.reported_by) ?? null : null });
        byTask.set(b.task_id, arr);
      }
      return byTask;
    },
  });


  const { data: logs } = useQuery({
    queryKey: ["project-logs", projectId],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_logs").select("*")
        .eq("project_id", projectId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      const actorIds = Array.from(new Set(data.map((l) => l.actor_id).filter((x): x is string => !!x)));
      const { data: profiles } = actorIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
        : { data: [] as { id: string; full_name: string }[] };
      const map = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      return data.map((l) => ({ ...l, actor_name: l.actor_id ? map.get(l.actor_id) ?? null : null }));
    },
  });

  if (isLoading) return <p className="text-muted-foreground">جاري التحميل...</p>;
  if (!project) return <p className="text-destructive">المشروع غير موجود</p>;

  const progressStages = stages?.filter((s) => s.stage_type === "progress") ?? [];
  const completedCount = progressStages.filter((s) => s.status === "completed").length;
  const progressPct = progressStages.length ? Math.round((completedCount / progressStages.length) * 100) : 0;
  const profit = Number(project.collected_amount ?? 0) - Number(project.purchase_cost ?? 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button variant="ghost" asChild className="mb-2">
            <Link to="/projects"><ArrowLeft className="ms-2 h-4 w-4" /> العودة للمشاريع</Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">{project.name}</h1>
          {project.client_name && <p className="text-sm text-muted-foreground mt-1">العميل: {project.client_name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge>{project.project_type === "tender" ? "مناقصة" : "أمر مباشر"}</Badge>
          <Badge variant="outline">
            {project.status === "active" ? "نشط" : project.status === "completed" ? "مكتمل" : project.status === "cancelled" ? "ملغي" : "متوقف"}
          </Badge>
          {isAdmin && <DeleteProjectButton projectId={projectId} projectName={project.name} />}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">نسبة التقدم</span>
            <span className="text-sm text-muted-foreground">{completedCount} / {progressStages.length} مرحلة</span>
          </div>
          <Progress value={progressPct} />
        </CardContent>
      </Card>

      <Tabs defaultValue="stages">
        <TabsList>
          <TabsTrigger value="stages">المراحل</TabsTrigger>
          <TabsTrigger value="tasks">المهام</TabsTrigger>
          {isAdmin && <TabsTrigger value="financial">المالية</TabsTrigger>}
          {isAdmin && <TabsTrigger value="timeline">السجل الزمني</TabsTrigger>}
          {isAdmin && <TabsTrigger value="settings">إعدادات المشروع</TabsTrigger>}
        </TabsList>

        <TabsContent value="stages" className="space-y-3 mt-4">
          {isAdmin && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ApplyTemplateDialog projectId={projectId} projectType={project.project_type} />
              <AddStageDialog projectId={projectId} />
            </div>
          )}
          {!stages?.length && (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              لا توجد مراحل بعد. {isAdmin ? "أضف مرحلة جديدة أو طبّق قالباً جاهزاً." : ""}
            </CardContent></Card>
          )}

          {stages?.map((stage) => {
            const stageTasks = tasks?.filter((t) => t.stage_id === stage.id) ?? [];
            return (
              <Card key={stage.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <StageStatusIcon status={stage.status} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{stage.order_index}. {stage.name}</h3>
                          {stage.stage_type === "informational" && (
                            <Badge variant="outline" className="text-xs">معلوماتية</Badge>
                          )}
                        </div>
                        {stage.description && <p className="text-sm text-muted-foreground mt-1">{stage.description}</p>}
                        {stage.deadline && (
                          <p className="text-xs text-muted-foreground mt-2">
                            الموعد: {new Date(stage.deadline).toLocaleDateString("ar-EG")}
                          </p>
                        )}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <StageStatusSelect stage={stage} />
                        <AddTaskDialog stageId={stage.id} stageName={stage.name} projectId={projectId} />
                        <DeleteStageButton stageId={stage.id} stageName={stage.name} projectId={projectId} />
                      </div>
                    )}

                  </div>
                  {stageTasks.length > 0 && (
                    <div className="mt-4 space-y-2 ps-9">
                      {stageTasks.map((t) => (
                        <Link
                          key={t.id} to="/tasks/$taskId" params={{ taskId: t.id }}
                          className="flex items-center justify-between p-2 rounded border border-border hover:bg-accent transition-colors"
                        >
                          <div>
                            <div className="text-sm font-medium">{t.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {t.assignee_name ?? "غير مسند"}
                            </div>
                          </div>
                          <TaskStatusBadge status={t.status} />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-2">
              {tasks?.length ? tasks.map((t) => (
                <Link key={t.id} to="/tasks/$taskId" params={{ taskId: t.id }}
                  className="flex items-center justify-between p-3 rounded border border-border hover:bg-accent transition-colors">
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-muted-foreground">
                      مسند إلى: {t.assignee_name ?? "—"}
                      {t.deadline && ` • ${new Date(t.deadline).toLocaleDateString("ar-EG")}`}
                    </div>
                  </div>
                  <TaskStatusBadge status={t.status} />
                </Link>
              )) : <p className="text-sm text-muted-foreground text-center py-6">لا توجد مهام</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="financial" className="mt-4">
            <FinancialTab project={project} profit={profit} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="timeline" className="mt-4">
            <Card>
              <CardContent className="pt-6 space-y-3">
                {logs?.length ? logs.map((l) => (
                  <div key={l.id} className="flex gap-3 pb-3 border-b border-border last:border-0">
                    <div className="text-xs text-muted-foreground whitespace-nowrap pt-1">
                      {new Date(l.created_at).toLocaleString("ar-EG")}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{translateAction(l.action)}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.actor_name ?? "النظام"}
                        {l.details && typeof l.details === "object" && " — " + JSON.stringify(l.details, null, 0).replace(/[{}"]/g, "").replace(/,/g, "، ")}
                      </div>
                    </div>
                  </div>
                )) : <p className="text-sm text-muted-foreground text-center py-6">لا يوجد سجل</p>}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="settings" className="mt-4">
            <ProjectSettingsTab project={project} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function StageStatusIcon({ status }: { status: string }) {
  const cls = "h-5 w-5 shrink-0 mt-0.5";
  if (status === "completed") return <CheckCircle2 className={`${cls} text-success`} />;
  if (status === "in_progress") return <Clock className={`${cls} text-warning`} />;
  if (status === "blocked") return <AlertCircle className={`${cls} text-destructive`} />;
  return <Circle className={`${cls} text-muted-foreground`} />;
}

function TaskStatusBadge({ status }: { status: string }) {
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

function StageStatusSelect({ stage }: { stage: { id: string; status: string } }) {
  const update = useServerFn(updateStageStatus);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (status: "pending" | "in_progress" | "completed" | "blocked") =>
      update({ data: { stageId: stage.id, status } }),
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries(); },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Select value={stage.status} onValueChange={(v: "pending" | "in_progress" | "completed" | "blocked") => m.mutate(v)}>
      <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">قيد الانتظار</SelectItem>
        <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
        <SelectItem value="completed">مكتملة</SelectItem>
        <SelectItem value="blocked">معطّلة</SelectItem>
      </SelectContent>
    </Select>
  );
}

function AddTaskDialog({ stageId, stageName, projectId }: { stageId: string; stageName: string; projectId: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", assigneeId: "", deadline: "" });
  const create = useServerFn(createTask);
  const list = useServerFn(listEmployees);
  const qc = useQueryClient();
  const { data: employees } = useQuery({ queryKey: ["employees-list"], queryFn: () => list(), enabled: open });
  const m = useMutation({
    mutationFn: () => create({ data: {
      stageId, title: form.title,
      description: form.description || null,
      assigneeId: form.assigneeId,
      deadline: new Date(form.deadline).toISOString(),
    }}),
    onSuccess: () => {
      toast.success("تم إنشاء المهمة وإرسال التنبيهات");
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      setOpen(false);
      setForm({ title: "", description: "", assigneeId: "", deadline: "" });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><UserPlus className="ms-2 h-3 w-3" /> إسناد مهمة</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إسناد مهمة في مرحلة: {stageName}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="space-y-2">
            <Label>عنوان المهمة</Label>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>الوصف</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>الموظف</Label>
            <Select value={form.assigneeId} onValueChange={(v) => setForm({ ...form, assigneeId: v })}>
              <SelectTrigger><SelectValue placeholder="اختر موظف" /></SelectTrigger>
              <SelectContent>
                {employees?.filter((e) => e.is_active).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>الموعد النهائي</Label>
            <Input type="datetime-local" required value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={m.isPending || !form.assigneeId}>
              {m.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              إسناد
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  client_name: string | null;
  status: "active" | "completed" | "cancelled" | "on_hold";
  expected_end_date: string | null;
  purchase_cost: number | null;
  collected_amount: number | null;
}

function FinancialTab({ project, profit }: { project: ProjectRow; profit: number }) {
  const update = useServerFn(updateProject);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    purchaseCost: Number(project.purchase_cost ?? 0),
    collectedAmount: Number(project.collected_amount ?? 0),
  });
  const m = useMutation({
    mutationFn: () => update({ data: {
      id: project.id,
      name: project.name,
      description: project.description,
      clientName: project.client_name,
      status: project.status,
      expectedEndDate: project.expected_end_date,
      purchaseCost: form.purchaseCost,
      collectedAmount: form.collectedAmount,
    }}),
    onSuccess: () => { toast.success("تم حفظ البيانات المالية"); qc.invalidateQueries({ queryKey: ["project", project.id] }); },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">البيانات المالية للمشروع</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>تكلفة شراء البنود</Label>
              <Input type="number" min={0} step="0.01" value={form.purchaseCost}
                onChange={(e) => setForm({ ...form, purchaseCost: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>المبلغ المحصّل</Label>
              <Input type="number" min={0} step="0.01" value={form.collectedAmount}
                onChange={(e) => setForm({ ...form, collectedAmount: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="p-4 rounded-md bg-accent/40">
            <div className="text-xs text-muted-foreground">الربح الصافي</div>
            <div className={`text-2xl font-bold mt-1 ${profit >= 0 ? "text-success" : "text-destructive"}`}>
              {profit.toLocaleString("ar-EG")} ج.م
            </div>
          </div>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProjectSettingsTab({ project }: { project: ProjectRow }) {
  const update = useServerFn(updateProject);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? "",
    clientName: project.client_name ?? "",
    status: project.status,
    expectedEndDate: project.expected_end_date ?? "",
  });
  const m = useMutation({
    mutationFn: () => update({ data: {
      id: project.id,
      name: form.name,
      description: form.description || null,
      clientName: form.clientName || null,
      status: form.status,
      expectedEndDate: form.expectedEndDate || null,
      purchaseCost: Number(project.purchase_cost ?? 0),
      collectedAmount: Number(project.collected_amount ?? 0),
    }}),
    onSuccess: () => { toast.success("تم التحديث"); qc.invalidateQueries({ queryKey: ["project", project.id] }); },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Card>
      <CardContent className="pt-6">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="space-y-2">
            <Label>اسم المشروع</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>العميل</Label>
            <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>الوصف</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v: ProjectRow["status"]) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="completed">مكتمل</SelectItem>
                  <SelectItem value="on_hold">متوقف</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>تاريخ الانتهاء المتوقع</Label>
              <Input type="date" value={form.expectedEndDate} onChange={(e) => setForm({ ...form, expectedEndDate: e.target.value })} />
            </div>
          </div>
          <Button type="submit" disabled={m.isPending}>
            {m.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            حفظ
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function translateAction(action: string): string {
  const map: Record<string, string> = {
    project_created: "تم إنشاء المشروع",
    project_updated: "تم تحديث المشروع",
    stage_status_changed: "تم تغيير حالة مرحلة",
    stage_added: "تم إضافة مرحلة",
    stage_deleted: "تم حذف مرحلة",
    template_applied: "تم تطبيق قالب",
    task_assigned: "تم إسناد مهمة",
    task_status_changed: "تم تغيير حالة مهمة",
  };
  return map[action] ?? action;
}

function AddStageDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "",
    stageType: "progress" as "progress" | "informational",
    expectedDays: 3, deadline: "",
    requiresAttachments: false, requiresFinancial: false,
  });
  const add = useServerFn(addProjectStage);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => add({ data: {
      projectId, name: form.name,
      description: form.description || null,
      stageType: form.stageType,
      expectedDays: form.expectedDays,
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      requiresAttachments: form.requiresAttachments,
      requiresFinancial: form.requiresFinancial,
    }}),
    onSuccess: () => {
      toast.success("تم إضافة المرحلة");
      qc.invalidateQueries({ queryKey: ["project-stages", projectId] });
      setOpen(false);
      setForm({ name: "", description: "", stageType: "progress", expectedDays: 3, deadline: "", requiresAttachments: false, requiresFinancial: false });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="ms-2 h-4 w-4" /> إضافة مرحلة</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>إضافة مرحلة جديدة</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="space-y-2">
            <Label>اسم المرحلة</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>الوصف</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={form.stageType} onValueChange={(v: "progress" | "informational") => setForm({ ...form, stageType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="progress">مرحلة تقدم</SelectItem>
                  <SelectItem value="informational">معلوماتية</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>المدة المتوقعة (أيام)</Label>
              <Input type="number" min={1} value={form.expectedDays}
                onChange={(e) => setForm({ ...form, expectedDays: parseInt(e.target.value) || 1 })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>الموعد النهائي (اختياري)</Label>
            <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>تتطلب مرفقات</Label>
            <Switch checked={form.requiresAttachments} onCheckedChange={(c) => setForm({ ...form, requiresAttachments: c })} />
          </div>
          <div className="flex items-center justify-between">
            <Label>تتطلب بيانات مالية</Label>
            <Switch checked={form.requiresFinancial} onCheckedChange={(c) => setForm({ ...form, requiresFinancial: c })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              إضافة
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ApplyTemplateDialog({ projectId, projectType }: { projectId: string; projectType: "tender" | "direct" }) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const apply = useServerFn(applyTemplateToProject);
  const qc = useQueryClient();
  const { data: templates } = useQuery({
    queryKey: ["templates", projectType],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("workflow_templates")
        .select("id, name, is_default").eq("project_type", projectType).order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const m = useMutation({
    mutationFn: () => apply({ data: { projectId, templateId } }),
    onSuccess: () => {
      toast.success("تم تطبيق القالب");
      qc.invalidateQueries({ queryKey: ["project-stages", projectId] });
      setOpen(false); setTemplateId("");
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><LayoutTemplate className="ms-2 h-4 w-4" /> تطبيق قالب</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>تطبيق قالب مراحل</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">سيتم إضافة مراحل القالب إلى المشروع (لا تستبدل المراحل الموجودة).</p>
          <div className="space-y-2">
            <Label>القالب</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="اختر قالب" /></SelectTrigger>
              <SelectContent>
                {templates?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}{t.is_default ? " (افتراضي)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={() => m.mutate()} disabled={!templateId || m.isPending}>
              {m.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              تطبيق
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStageButton({ stageId, stageName, projectId }: { stageId: string; stageName: string; projectId: string }) {
  const del = useServerFn(deleteProjectStage);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => del({ data: { stageId } }),
    onSuccess: () => {
      toast.success("تم حذف المرحلة");
      qc.invalidateQueries({ queryKey: ["project-stages", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
      onClick={() => { if (confirm(`حذف المرحلة "${stageName}" وكل مهامها؟`)) m.mutate(); }}
      disabled={m.isPending}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const del = useServerFn(deleteProject);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => del({ data: { projectId } }),
    onSuccess: () => {
      toast.success("تم حذف المشروع");
      qc.invalidateQueries({ queryKey: ["projects-list"] });
      navigate({ to: "/projects" });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={m.isPending}
      onClick={() => {
        if (confirm(`حذف المشروع "${projectName}" نهائياً مع كل مراحله ومهامه؟ لا يمكن التراجع.`)) m.mutate();
      }}
    >
      {m.isPending ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Trash2 className="ms-2 h-4 w-4" />}
      حذف المشروع
    </Button>
  );
}

