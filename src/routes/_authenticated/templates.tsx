import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { upsertTemplate, deleteTemplate } from "@/lib/templates.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, ArrowUp, ArrowDown, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/templates")({
  component: TemplatesPage,
});

interface StageDraft {
  name: string;
  description: string;
  stageType: "progress" | "informational";
  expectedDays: number;
  requiresAttachments: boolean;
  requiresFinancial: boolean;
}

function TemplatesPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (role && role !== "admin") navigate({ to: "/dashboard", replace: true });
  }, [role, navigate]);
  const qc = useQueryClient();
  const del = useServerFn(deleteTemplate);
  const [editing, setEditing] = useState<{ id?: string; name: string; description: string; projectType: "tender" | "direct"; stages: StageDraft[] } | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_templates")
        .select("*, workflow_template_stages(*)")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["templates-all"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">قوالب المراحل</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة قوالب الـ Workflow المستخدمة في إنشاء المشاريع</p>
        </div>
        <Button onClick={() => setEditing({ name: "", description: "", projectType: "tender", stages: [{ name: "", description: "", stageType: "progress", expectedDays: 3, requiresAttachments: false, requiresFinancial: false }] })}>
          <Plus className="ms-2 h-4 w-4" /> قالب جديد
        </Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">جاري التحميل...</p> :
        <div className="space-y-4">
          {templates?.map((t) => (
            <Card key={t.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-lg">{t.name}</h3>
                      <Badge variant={t.project_type === "tender" ? "default" : "secondary"}>
                        {t.project_type === "tender" ? "مناقصة" : "أمر مباشر"}
                      </Badge>
                      {t.is_default && <Badge variant="outline">افتراضي</Badge>}
                    </div>
                    {t.description && <p className="text-sm text-muted-foreground mt-1">{t.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditing({
                      id: t.id,
                      name: t.name,
                      description: t.description ?? "",
                      projectType: t.project_type,
                      stages: (t.workflow_template_stages as Array<{ name: string; description: string | null; stage_type: "progress" | "informational"; order_index: number; expected_days: number; requires_attachments: boolean; requires_financial: boolean }>)
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((s) => ({
                          name: s.name, description: s.description ?? "",
                          stageType: s.stage_type, expectedDays: s.expected_days,
                          requiresAttachments: s.requires_attachments,
                          requiresFinancial: s.requires_financial,
                        })),
                    })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>حذف القالب؟</AlertDialogTitle>
                          <AlertDialogDescription>لن يؤثر على المشاريع القائمة.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>إلغاء</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteM.mutate(t.id)}>حذف</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(t.workflow_template_stages as Array<{ name: string; order_index: number; expected_days: number; stage_type: string }>)
                    .sort((a, b) => a.order_index - b.order_index)
                    .map((s, i) => (
                      <div key={i} className="text-sm p-2 rounded bg-accent/40">
                        <span className="font-medium">{s.order_index}. {s.name}</span>
                        <span className="text-xs text-muted-foreground ms-2">({s.expected_days} يوم{s.stage_type === "informational" ? " • معلوماتية" : ""})</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      }

      {editing && (
        <TemplateEditorDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["templates-all"] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function TemplateEditorDialog({ initial, onClose, onSaved }: {
  initial: { id?: string; name: string; description: string; projectType: "tender" | "direct"; stages: StageDraft[] };
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(initial);
  const upsert = useServerFn(upsertTemplate);
  const m = useMutation({
    mutationFn: () => upsert({ data: {
      id: form.id,
      name: form.name,
      description: form.description || null,
      projectType: form.projectType,
      stages: form.stages.map((s, idx) => ({
        name: s.name, description: s.description || null,
        stageType: s.stageType, orderIndex: idx + 1, expectedDays: s.expectedDays,
        requiresAttachments: s.requiresAttachments, requiresFinancial: s.requiresFinancial,
      })),
    }}),
    onSuccess: () => { toast.success("تم الحفظ"); onSaved(); },
    onError: (err: Error) => toast.error(err.message),
  });

  function update(idx: number, patch: Partial<StageDraft>) {
    setForm({ ...form, stages: form.stages.map((s, i) => i === idx ? { ...s, ...patch } : s) });
  }
  function move(idx: number, dir: -1 | 1) {
    const ni = idx + dir;
    if (ni < 0 || ni >= form.stages.length) return;
    const arr = [...form.stages];
    [arr[idx], arr[ni]] = [arr[ni], arr[idx]];
    setForm({ ...form, stages: arr });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "تعديل قالب" : "قالب جديد"}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(); }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم القالب</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>النوع</Label>
              <Select value={form.projectType} onValueChange={(v: "tender" | "direct") => setForm({ ...form, projectType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tender">مناقصة</SelectItem>
                  <SelectItem value="direct">أمر مباشر</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>الوصف</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>المراحل</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, stages: [...form.stages, { name: "", description: "", stageType: "progress", expectedDays: 3, requiresAttachments: false, requiresFinancial: false }] })}>
                <Plus className="ms-2 h-3 w-3" /> إضافة مرحلة
              </Button>
            </div>
            <div className="space-y-3">
              {form.stages.map((s, idx) => (
                <Card key={idx}>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{idx + 1}</Badge>
                      <Input placeholder="اسم المرحلة" required value={s.name} onChange={(e) => update(idx, { name: e.target.value })} />
                      <Button type="button" size="icon" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0}><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => move(idx, 1)} disabled={idx === form.stages.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => setForm({ ...form, stages: form.stages.filter((_, i) => i !== idx) })} disabled={form.stages.length === 1}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <Textarea rows={2} placeholder="وصف اختياري" value={s.description} onChange={(e) => update(idx, { description: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">النوع</Label>
                        <Select value={s.stageType} onValueChange={(v: "progress" | "informational") => update(idx, { stageType: v })}>
                          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="progress">مرحلة تقدم</SelectItem>
                            <SelectItem value="informational">معلوماتية</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">المدة المتوقعة (أيام)</Label>
                        <Input type="number" min={1} className="h-8" value={s.expectedDays} onChange={(e) => update(idx, { expectedDays: parseInt(e.target.value) || 1 })} />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={s.requiresAttachments} onCheckedChange={(v) => update(idx, { requiresAttachments: v })} />
                        مرفقات مطلوبة
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={s.requiresFinancial} onCheckedChange={(v) => update(idx, { requiresFinancial: v })} />
                        حقول مالية
                      </label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={m.isPending}>
              {m.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              حفظ القالب
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
