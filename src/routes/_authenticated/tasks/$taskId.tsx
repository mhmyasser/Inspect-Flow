import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
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
import { ArrowLeft, AlertCircle, Loader2, Paperclip, Send, FileText, Image as ImageIcon, Eye, Download, CheckCircle2, ShieldAlert } from "lucide-react";

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
  const [mentions, setMentions] = useState<Record<string, string>>({});
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const add = useServerFn(addTaskComment);
  const qc = useQueryClient();
  const { data: members = [] } = useQuery({
    queryKey: ["profiles-mention"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return (data ?? []).filter((p): p is { id: string; full_name: string } => !!p.full_name);
    },
    staleTime: 60_000,
  });
  const m = useMutation({
    mutationFn: () => {
      const active = Object.entries(mentions)
        .filter(([, name]) => content.includes(`@${name}`))
        .map(([id]) => id);
      return add({ data: { taskId, content, mentions: active } });
    },
    onSuccess: () => {
      setContent(""); setMentions({});
      qc.invalidateQueries({ queryKey: ["task-comments", taskId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    const caret = e.target.selectionStart ?? val.length;
    const before = val.slice(0, caret);
    const match = /@(\S{0,30})$/.exec(before);
    if (match) { setPickerQuery(match[1]); setShowPicker(true); }
    else setShowPicker(false);
  }

  function pick(p: { id: string; full_name: string }) {
    const ta = textareaRef.current; if (!ta) return;
    const caret = ta.selectionStart ?? content.length;
    const before = content.slice(0, caret);
    const after = content.slice(caret);
    const newBefore = before.replace(/@\S*$/, `@${p.full_name} `);
    const next = newBefore + after;
    setContent(next);
    setMentions((mp) => ({ ...mp, [p.id]: p.full_name }));
    setShowPicker(false);
    setTimeout(() => {
      ta.focus();
      const pos = newBefore.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }

  const q = pickerQuery.toLowerCase();
  const filtered = members
    .filter((mm) => !q || mm.full_name.toLowerCase().includes(q))
    .slice(0, 6);

  return (
    <form
      className="pt-3 border-t border-border space-y-2"
      onSubmit={(e) => { e.preventDefault(); if (content.trim()) m.mutate(); }}
    >
      <div className="relative">
        <Textarea
          ref={textareaRef}
          placeholder="أضف تعليقاً... (اكتب @ لذكر زميل)"
          value={content}
          onChange={handleChange}
          rows={2}
          maxLength={2000}
        />
        {showPicker && filtered.length > 0 && (
          <div className="absolute bottom-full mb-1 start-0 z-20 w-64 bg-popover border border-border rounded-md shadow-md max-h-56 overflow-auto">
            {filtered.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => pick(p)}
                className="block w-full text-start px-3 py-2 text-sm hover:bg-accent"
              >
                @{p.full_name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={m.isPending || !content.trim()}>
          {m.isPending ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Send className="ms-2 h-4 w-4" />}
          إرسال
        </Button>
      </div>
    </form>
  );
}

function UploadAttachmentForm({ taskId, userId, onUploaded }: { taskId: string; userId: string; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("حجم الملف يتجاوز 20MB"); return; }
    setUploading(true);
    try {
      const path = `${userId}/${taskId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("task-attachments").upload(path, file, {
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const name = (displayName.trim() || file.name).slice(0, 120);
      const { error: insErr } = await supabase.from("task_attachments").insert({
        task_id: taskId, file_path: path, file_name: name,
        file_size: file.size, mime_type: file.type, uploaded_by: userId,
      });
      if (insErr) throw insErr;
      toast.success("تم رفع الملف");
      setFile(null); setDisplayName("");
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الرفع");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={submit} className="pt-3 border-t border-border space-y-2">
      <Input
        type="file"
        accept=".pdf,image/*"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          if (f) setDisplayName(f.name.replace(/\.[^.]+$/, ""));
        }}
        disabled={uploading}
      />
      {file && (
        <>
          <Input
            placeholder="اسم العرض للمرفق"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={120}
          />
          <Button type="submit" size="sm" disabled={uploading}>
            {uploading ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Paperclip className="ms-2 h-4 w-4" />}
            رفع المرفق
          </Button>
        </>
      )}
    </form>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentLink({ attachment }: { attachment: { id: string; file_path: string; file_name: string; file_size: number | null; mime_type: string | null } }) {
  async function openUrl(download: boolean) {
    const opts = download ? { download: attachment.file_name } : undefined;
    const { data, error } = await supabase.storage
      .from("task-attachments")
      .createSignedUrl(attachment.file_path, 300, opts);
    if (error || !data) { toast.error("تعذر فتح الملف"); return; }
    window.open(data.signedUrl, "_blank");
  }
  const isImage = attachment.mime_type?.startsWith("image/");
  return (
    <div className="flex items-center gap-2 p-2 rounded border border-border">
      {isImage ? <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" /> : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{attachment.file_name}</div>
        {attachment.file_size != null && (
          <div className="text-xs text-muted-foreground">{formatSize(attachment.file_size)}</div>
        )}
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={() => openUrl(false)} title="عرض">
        <Eye className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => openUrl(true)} title="تحميل">
        <Download className="h-4 w-4" />
      </Button>
    </div>
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

type BlockerRow = {
  id: string; reason: string; resolved: boolean;
  created_at: string; resolved_at: string | null;
  resolution_note: string | null;
  reporter_name: string | null; resolver_name: string | null;
};

function BlockersCard({ taskId, blockers, isAdmin }: { taskId: string; blockers: BlockerRow[]; isAdmin: boolean }) {
  const open = blockers.filter((b) => !b.resolved);
  const resolved = blockers.filter((b) => b.resolved);
  if (!blockers.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-warning" />
          العوائق ({open.length} مفتوح{resolved.length ? ` • ${resolved.length} تم حله` : ""})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {open.map((b) => (
          <div key={b.id} className="p-3 rounded-md border border-destructive/40 bg-destructive/5">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <div className="text-xs text-muted-foreground">
                أبلغ عنه: <span className="text-foreground font-medium">{b.reporter_name ?? "—"}</span>
                {" • "}{new Date(b.created_at).toLocaleString("ar-EG")}
              </div>
              <Badge variant="destructive">مفتوح</Badge>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">{b.reason}</p>
            {isAdmin && (
              <div className="mt-2">
                <ResolveBlockerButton blockerId={b.id} taskId={taskId} />
              </div>
            )}
          </div>
        ))}
        {resolved.map((b) => (
          <div key={b.id} className="p-3 rounded-md border border-border bg-muted/30 opacity-90">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
              <div className="text-xs text-muted-foreground">
                أبلغ عنه: <span className="text-foreground">{b.reporter_name ?? "—"}</span>
                {" • "}{new Date(b.created_at).toLocaleString("ar-EG")}
              </div>
              <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> تم الحل</Badge>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words">{b.reason}</p>
            {b.resolution_note && (
              <div className="text-xs mt-2 p-2 rounded bg-background border border-border">
                <span className="text-muted-foreground">ملاحظة الحل ({b.resolver_name ?? "—"}
                {b.resolved_at ? ` • ${new Date(b.resolved_at).toLocaleString("ar-EG")}` : ""}):</span>
                <p className="mt-1 whitespace-pre-wrap">{b.resolution_note}</p>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ResolveBlockerButton({ blockerId, taskId }: { blockerId: string; taskId: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [resume, setResume] = useState(true);
  const resolve = useServerFn(resolveBlocker);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => resolve({ data: { blockerId, resolutionNote: note || null, resumeTask: resume } }),
    onSuccess: () => {
      toast.success("تم حل العائق");
      setOpen(false); setNote("");
      qc.invalidateQueries({ queryKey: ["task-blockers", taskId] });
      qc.invalidateQueries({ queryKey: ["task", taskId] });
      qc.invalidateQueries({ queryKey: ["dashboard-blockers"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><CheckCircle2 className="ms-2 h-3 w-3" /> حل العائق</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>حل العائق</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="space-y-2">
            <Label>ملاحظة الحل (اختياري)</Label>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={resume} onChange={(e) => setResume(e.target.checked)} />
            استئناف المهمة تلقائياً (إعادتها لقيد التنفيذ)
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

