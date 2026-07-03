import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { updateTaskStatus, addTaskComment, reportBlocker, resolveBlocker } from "@/lib/tasks.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, AlertCircle, Loader2, Paperclip, Send, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  component: TaskDetailPage,
});

function TaskDetailPage() {
  const { taskId } = Route.useParams();
  const { user, role } = useAuth();
  const qc = useQueryClient();

  const { data: task, isLoading } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").eq("id", taskId).single();
      if (error) throw error;
      const [{ data: stage }, { data: assignee }] = await Promise.all([
        supabase.from("project_stages").select("id, name, project_id").eq("id", data.stage_id).single(),
        data.assignee_id
          ? supabase.from("profiles").select("full_name").eq("id", data.assignee_id).single()
          : Promise.resolve({ data: null }),
      ]);
      const { data: project } = stage
        ? await supabase.from("projects").select("name").eq("id", stage.project_id).single()
        : { data: null };
      return { ...data, stage, project, assignee_name: assignee?.full_name ?? null };
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at");
      if (error) throw error;
      const ids = Array.from(new Set(data.map((c) => c.author_id)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as { id: string; full_name: string }[] };
      const map = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return data.map((c) => ({ ...c, author_name: map.get(c.author_id) ?? "" }));
    },
  });

  const { data: attachments } = useQuery({
    queryKey: ["task-attachments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_attachments").select("*").eq("task_id", taskId).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: blockers } = useQuery({
    queryKey: ["task-blockers", taskId],
    queryFn: async () => {
      const { data, error } = await supabase.from("blockers")
        .select("*").eq("task_id", taskId).order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(new Set(data.flatMap((b) => [b.reported_by, b.resolved_by]).filter((x): x is string => !!x)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name").in("id", ids)
        : { data: [] as { id: string; full_name: string }[] };
      const map = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
      return data.map((b) => ({
        ...b,
        reporter_name: b.reported_by ? map.get(b.reported_by) ?? null : null,
        resolver_name: b.resolved_by ? map.get(b.resolved_by) ?? null : null,
      }));
    },
  });

  if (isLoading) return <p className="text-muted-foreground">جاري التحميل...</p>;
  if (!task) return <p className="text-destructive">المهمة غير موجودة</p>;

  const isAssignee = task.assignee_id === user?.id;
  const isAdmin = role === "admin";
  const canEdit = isAssignee || isAdmin;
  const overdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== "completed";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Button variant="ghost" asChild className="mb-2">
          {task.stage ? (
            <Link to="/projects/$projectId" params={{ projectId: task.stage.project_id }}>
              <ArrowLeft className="ms-2 h-4 w-4" /> العودة للمشروع
            </Link>
          ) : (
            <Link to="/my-tasks"><ArrowLeft className="ms-2 h-4 w-4" /> العودة لمهامي</Link>
          )}
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold">{task.title}</h1>
        {task.project && task.stage && (
          <p className="text-sm text-muted-foreground mt-1">
            {task.project.name} → {task.stage.name}
          </p>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          {task.description && (
            <div>
              <Label className="text-xs">الوصف</Label>
              <p className="text-sm mt-1 whitespace-pre-wrap">{task.description}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Label className="text-xs">المسؤول</Label>
              <p className="mt-1">{task.assignee_name ?? "غير مسند"}</p>
            </div>
            <div>
              <Label className="text-xs">الموعد النهائي</Label>
              <p className={`mt-1 ${overdue ? "text-destructive font-medium" : ""}`}>
                {task.deadline ? new Date(task.deadline).toLocaleString("ar-EG") : "—"}
              </p>
            </div>
            <div>
              <Label className="text-xs">الحالة</Label>
              <div className="mt-1"><StatusBadge status={task.status} /></div>
            </div>
            <div>
              <Label className="text-xs">تاريخ الإسناد</Label>
              <p className="mt-1">{new Date(task.assigned_at).toLocaleDateString("ar-EG")}</p>
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <UpdateStatusControl taskId={task.id} currentStatus={task.status} />
              {isAssignee && task.status !== "completed" && task.status !== "blocked" && (
                <ReportBlockerButton taskId={task.id} />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="h-4 w-4" /> المرفقات ({attachments?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {attachments?.length ? (
            <div className="space-y-1">
              {attachments.map((a) => (
                <AttachmentLink key={a.id} attachment={a} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">لا توجد مرفقات</p>
          )}
          {canEdit && <UploadAttachmentForm taskId={task.id} userId={user!.id} onUploaded={() => qc.invalidateQueries({ queryKey: ["task-attachments", taskId] })} />}
        </CardContent>
      </Card>

      <BlockersCard
        taskId={task.id}
        blockers={blockers ?? []}
        isAdmin={isAdmin}
      />



      <Card>
        <CardHeader>
          <CardTitle className="text-base">التعليقات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {comments?.length ? comments.map((c) => (
            <div key={c.id} className="p-3 rounded-md bg-accent/40">
              <div className="text-xs text-muted-foreground mb-1">
                {c.author_name} • {new Date(c.created_at).toLocaleString("ar-EG")}
              </div>
              <div className="text-sm whitespace-pre-wrap">{c.content}</div>
            </div>
          )) : <p className="text-sm text-muted-foreground text-center py-4">لا توجد تعليقات</p>}
          {canEdit && <AddCommentForm taskId={task.id} />}
        </CardContent>
      </Card>
    </div>
  );
}

function UpdateStatusControl({ taskId, currentStatus }: { taskId: string; currentStatus: string }) {
  const update = useServerFn(updateTaskStatus);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (status: "pending" | "in_progress" | "completed" | "blocked") =>
      update({ data: { taskId, status } }),
    onSuccess: () => { toast.success("تم تحديث الحالة"); qc.invalidateQueries(); },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Select value={currentStatus} onValueChange={(v: "pending" | "in_progress" | "completed" | "blocked") => m.mutate(v)}>
      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">جديدة</SelectItem>
        <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
        <SelectItem value="completed">مكتملة</SelectItem>
        <SelectItem value="blocked">معطّلة</SelectItem>
      </SelectContent>
    </Select>
  );
}

function ReportBlockerButton({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const report = useServerFn(reportBlocker);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => report({ data: { taskId, reason } }),
    onSuccess: () => { toast.success("تم الإبلاغ"); setOpen(false); setReason(""); qc.invalidateQueries(); },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm"><AlertCircle className="ms-2 h-4 w-4" /> إبلاغ عن عائق</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>الإبلاغ عن عائق</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="space-y-2">
            <Label>اشرح المشكلة التي تواجهها</Label>
            <Textarea rows={4} required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" variant="destructive" disabled={m.isPending}>
              {m.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              إرسال الإبلاغ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddCommentForm({ taskId }: { taskId: string }) {
  const [content, setContent] = useState("");
  const add = useServerFn(addTaskComment);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => add({ data: { taskId, content } }),
    onSuccess: () => { setContent(""); qc.invalidateQueries({ queryKey: ["task-comments", taskId] }); },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <form className="flex gap-2 pt-3 border-t border-border" onSubmit={(e) => { e.preventDefault(); if (content.trim()) m.mutate(); }}>
      <Input placeholder="أضف تعليقاً..." value={content} onChange={(e) => setContent(e.target.value)} maxLength={2000} />
      <Button type="submit" size="icon" disabled={m.isPending || !content.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}

function UploadAttachmentForm({ taskId, userId, onUploaded }: { taskId: string; userId: string; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("حجم الملف يتجاوز 20MB"); return; }
    setUploading(true);
    try {
      const path = `${userId}/${taskId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("task-attachments").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("task_attachments").insert({
        task_id: taskId, file_path: path, file_name: file.name,
        file_size: file.size, mime_type: file.type, uploaded_by: userId,
      });
      if (insErr) throw insErr;
      toast.success("تم رفع الملف");
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }
  return (
    <div className="pt-3 border-t border-border">
      <Label htmlFor="file" className="cursor-pointer inline-flex items-center gap-2 text-sm text-primary hover:underline">
        <Paperclip className="h-4 w-4" /> {uploading ? "جاري الرفع..." : "إرفاق ملف (PDF / صورة)"}
      </Label>
      <Input id="file" type="file" className="hidden" onChange={handleFile} disabled={uploading} accept=".pdf,image/*" />
    </div>
  );
}

function AttachmentLink({ attachment }: { attachment: { id: string; file_path: string; file_name: string; mime_type: string | null } }) {
  async function open() {
    const { data, error } = await supabase.storage.from("task-attachments").createSignedUrl(attachment.file_path, 300);
    if (error || !data) { toast.error("تعذر فتح الملف"); return; }
    window.open(data.signedUrl, "_blank");
  }
  return (
    <button onClick={open} className="flex items-center gap-2 p-2 w-full rounded hover:bg-accent text-start">
      <FileText className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm truncate flex-1">{attachment.file_name}</span>
    </button>
  );
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
