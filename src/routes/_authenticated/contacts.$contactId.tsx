import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ContactFormDialog } from "@/components/contacts/contacts-list";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, Mail, Phone, MapPin, FileText, Paperclip,
  Loader2, Eye, Download, Image as ImageIcon, Trash2, Pencil,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/contacts/$contactId")({
  component: ContactDetailPage,
});

type TxnKind = "invoice" | "payment" | "receipt" | "credit" | "debit" | "other";

const TXN_LABEL: Record<TxnKind, string> = {
  invoice: "فاتورة",
  payment: "دفعة صادرة",
  receipt: "مقبوضات",
  credit: "دائن",
  debit: "مدين",
  other: "أخرى",
};

function ContactDetailPage() {
  const { contactId } = Route.useParams();
  const { role, loading } = useAuth();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", contactId],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").eq("id", contactId).single();
      if (error) throw error;
      return data;
    },
    enabled: role === "admin",
  });

  const { data: txns = [] } = useQuery({
    queryKey: ["contact-txns", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_transactions")
        .select("id, kind, amount, currency, occurred_on, description, project_id, projects(name)")
        .eq("contact_id", contactId)
        .order("occurred_on", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: role === "admin",
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["contact-attach", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_attachments")
        .select("*")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: role === "admin",
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["contact-projects", contactId, contact?.kind],
    queryFn: async () => {
      if (!contact) return [];
      const col = contact.kind === "customer" ? "customer_id" : "supplier_id";
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, status, created_at")
        .eq(col, contactId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!contact && role === "admin",
  });

  const update = useMutation({
    mutationFn: async (v: Record<string, string>) => {
      const { error } = await supabase.from("contacts").update({
        name: v.name,
        company: v.company || null, email: v.email || null, phone: v.phone || null,
        address: v.address || null, tax_id: v.tax_id || null, notes: v.notes || null,
      }).eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم التحديث");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["contact", contactId] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contacts").delete().eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["contacts"] });
      window.history.back();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return null;
  if (role !== "admin") return <Navigate to="/dashboard" />;
  if (isLoading) return <p className="text-muted-foreground">جاري التحميل...</p>;
  if (!contact) return <p className="text-destructive">غير موجود</p>;

  const balance = txns.reduce((sum, t) => {
    const sign = t.kind === "receipt" || t.kind === "credit" ? 1
      : t.kind === "payment" || t.kind === "debit" ? -1
      : t.kind === "invoice" ? (contact.kind === "customer" ? 1 : -1) : 0;
    return sum + sign * Number(t.amount);
  }, 0);

  const backLink = contact.kind === "customer" ? "/customers" : "/suppliers";
  const backLabel = contact.kind === "customer" ? "العملاء" : "الموردون";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <Button variant="ghost" asChild className="mb-2">
          <Link to={backLink}><ArrowLeft className="ms-2 h-4 w-4" /> {backLabel}</Link>
        </Button>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-md bg-primary/10 text-primary grid place-items-center">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{contact.name}</h1>
                {contact.company && <p className="text-muted-foreground text-sm">{contact.company}</p>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Pencil className="ms-2 h-4 w-4" /> تعديل</Button>
              </DialogTrigger>
              <ContactFormDialog
                title="تعديل البيانات"
                initial={{
                  name: contact.name, company: contact.company ?? "", email: contact.email ?? "",
                  phone: contact.phone ?? "", address: contact.address ?? "",
                  tax_id: contact.tax_id ?? "", notes: contact.notes ?? "",
                }}
                onSubmit={(v) => update.mutate(v)}
                submitting={update.isPending}
              />
            </Dialog>
            <Button variant="destructive" size="sm" onClick={() => { if (confirm("حذف نهائي مع جميع المعاملات والمرفقات؟")) del.mutate(); }}>
              <Trash2 className="ms-2 h-4 w-4" /> حذف
            </Button>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6">
          <div className="text-xs text-muted-foreground">الرصيد</div>
          <div className={`text-2xl font-bold mt-1 ${balance > 0 ? "text-success" : balance < 0 ? "text-destructive" : ""}`}>
            {balance.toLocaleString("ar-EG", { minimumFractionDigits: 2 })} {txns[0]?.currency ?? "SAR"}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {contact.kind === "customer" ? "موجب = مستحق لنا" : "سالب = مستحق عليهم"}
          </div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-xs text-muted-foreground">عدد المعاملات</div>
          <div className="text-2xl font-bold mt-1">{txns.length}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-xs text-muted-foreground">المشاريع المرتبطة</div>
          <div className="text-2xl font-bold mt-1">{projects.length}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">بيانات الاتصال</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3 text-sm">
          {contact.email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {contact.email}</div>}
          {contact.phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {contact.phone}</div>}
          {contact.address && <div className="flex items-center gap-2 md:col-span-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {contact.address}</div>}
          {contact.tax_id && <div><span className="text-muted-foreground text-xs">الرقم الضريبي: </span>{contact.tax_id}</div>}
          {contact.notes && <div className="md:col-span-2 whitespace-pre-wrap"><span className="text-muted-foreground text-xs">ملاحظات: </span>{contact.notes}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">المشاريع المرتبطة ({projects.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">لا توجد مشاريع مرتبطة</p>
          ) : (
            <div className="space-y-2">
              {projects.map((p) => (
                <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}>
                  <div className="flex items-center gap-3 p-3 rounded border border-border hover:bg-accent">
                    <span className="flex-1">{p.name}</span>
                    <Badge variant="outline">{p.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionsCard contactId={contactId} txns={txns} projectOptions={projects} onChange={() => qc.invalidateQueries({ queryKey: ["contact-txns", contactId] })} />

      <AttachmentsCard contactId={contactId} attachments={attachments} onChange={() => qc.invalidateQueries({ queryKey: ["contact-attach", contactId] })} />
    </div>
  );
}

function TransactionsCard({
  contactId, txns, projectOptions, onChange,
}: {
  contactId: string;
  txns: Array<{ id: string; kind: string; amount: number; currency: string; occurred_on: string; description: string | null; project_id: string | null; projects: { name: string } | { name: string }[] | null }>;
  projectOptions: Array<{ id: string; name: string }>;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<TxnKind>("invoice");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [occurredOn, setOccurredOn] = useState(new Date().toISOString().slice(0, 10));
  const [projectId, setProjectId] = useState<string>("none");
  const [description, setDescription] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("المبلغ غير صحيح");
      const { error } = await supabase.from("contact_transactions").insert({
        contact_id: contactId, kind, amount: amt, currency, occurred_on: occurredOn,
        description: description || null,
        project_id: projectId === "none" ? null : projectId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة"); setOpen(false); setAmount(""); setDescription("");
      onChange();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contact_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">المعاملات المالية ({txns.length})</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><FileText className="ms-2 h-4 w-4" /> إضافة معاملة</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>معاملة جديدة</DialogTitle></DialogHeader>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>النوع</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as TxnKind)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TXN_LABEL) as TxnKind[]).map((k) => (
                        <SelectItem key={k} value={k}>{TXN_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>التاريخ</Label><Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} required /></div>
                <div><Label>المبلغ</Label><Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
                <div><Label>العملة</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={10} /></div>
                <div className="col-span-2">
                  <Label>المشروع (اختياري)</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger><SelectValue placeholder="بدون مشروع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون مشروع</SelectItem>
                      {projectOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label>الوصف</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} /></div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={add.isPending}>
                  {add.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />} حفظ
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {txns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد معاملات</p>
        ) : (
          <div className="divide-y divide-border">
            {txns.map((t) => {
              const projName = Array.isArray(t.projects) ? t.projects[0]?.name : t.projects?.name;
              return (
                <div key={t.id} className="py-3 flex items-center gap-3 flex-wrap">
                  <Badge variant="outline">{TXN_LABEL[t.kind as TxnKind] ?? t.kind}</Badge>
                  <div className="text-sm">{new Date(t.occurred_on).toLocaleDateString("ar-EG")}</div>
                  <div className="font-medium">{Number(t.amount).toLocaleString("ar-EG", { minimumFractionDigits: 2 })} {t.currency}</div>
                  {projName && <Badge variant="secondary" className="text-xs">{projName}</Badge>}
                  {t.description && <div className="text-xs text-muted-foreground flex-1 min-w-[200px]">{t.description}</div>}
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("حذف المعاملة؟")) del.mutate(t.id); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttachmentsCard({
  contactId, attachments, onChange,
}: {
  contactId: string;
  attachments: Array<{ id: string; file_path: string; file_name: string; file_size: number | null; mime_type: string | null }>;
  onChange: () => void;
}) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !user) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("حجم الملف يتجاوز 20MB"); return; }
    setUploading(true);
    try {
      const path = `${user.id}/${contactId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("contact-attachments").upload(path, file, {
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const name = (displayName.trim() || file.name).slice(0, 120);
      const { error: insErr } = await supabase.from("contact_attachments").insert({
        contact_id: contactId, file_path: path, file_name: name,
        file_size: file.size, mime_type: file.type, uploaded_by: user.id,
      });
      if (insErr) throw insErr;
      toast.success("تم رفع الملف");
      setFile(null); setDisplayName("");
      onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الرفع");
    } finally { setUploading(false); }
  }

  async function openUrl(a: (typeof attachments)[number], download: boolean) {
    const opts = download ? { download: a.file_name } : undefined;
    const { data, error } = await supabase.storage.from("contact-attachments").createSignedUrl(a.file_path, 300, opts);
    if (error || !data) { toast.error("تعذر فتح الملف"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function remove(a: (typeof attachments)[number]) {
    if (!confirm("حذف المرفق؟")) return;
    await supabase.storage.from("contact-attachments").remove([a.file_path]);
    const { error } = await supabase.from("contact_attachments").delete().eq("id", a.id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    onChange();
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Paperclip className="h-4 w-4" /> المرفقات ({attachments.length})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد مرفقات</p>
        ) : attachments.map((a) => {
          const isImage = a.mime_type?.startsWith("image/");
          return (
            <div key={a.id} className="flex items-center gap-2 p-2 rounded border border-border">
              {isImage ? <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" /> : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{a.file_name}</div>
                {a.file_size != null && <div className="text-xs text-muted-foreground">{formatSize(a.file_size)}</div>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => openUrl(a, false)}><Eye className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => openUrl(a, true)}><Download className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          );
        })}
        <form onSubmit={submit} className="pt-3 border-t border-border space-y-2">
          <Input
            type="file"
            accept=".pdf,image/*,.doc,.docx,.xls,.xlsx"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f) setDisplayName(f.name.replace(/\.[^.]+$/, ""));
            }}
            disabled={uploading}
          />
          {file && (
            <>
              <Input placeholder="اسم العرض للمرفق" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={120} />
              <Button type="submit" size="sm" disabled={uploading}>
                {uploading ? <Loader2 className="ms-2 h-4 w-4 animate-spin" /> : <Paperclip className="ms-2 h-4 w-4" />} رفع المرفق
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
