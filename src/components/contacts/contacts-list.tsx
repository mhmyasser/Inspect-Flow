import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Search, Building2, Phone, Mail, ChevronLeft } from "lucide-react";

type Kind = "customer" | "supplier";

const LABELS: Record<Kind, { title: string; single: string; addBtn: string }> = {
  customer: { title: "العملاء", single: "عميل", addBtn: "إضافة عميل" },
  supplier: { title: "الموردون", single: "مورد", addBtn: "إضافة مورد" },
};

export function ContactsList({ kind }: { kind: Kind }) {
  const { role, loading } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const L = LABELS[kind];

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", kind],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, company, email, phone, created_at")
        .eq("kind", kind)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: role === "admin",
  });

  const create = useMutation({
    mutationFn: async (v: {
      name: string; company: string; email: string; phone: string;
      address: string; tax_id: string; notes: string;
    }) => {
      const { error } = await supabase.from("contacts").insert({
        kind, name: v.name,
        company: v.company || null, email: v.email || null, phone: v.phone || null,
        address: v.address || null, tax_id: v.tax_id || null, notes: v.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت الإضافة");
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["contacts", kind] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return null;
  if (role !== "admin") return <Navigate to="/dashboard" />;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? contacts.filter((c) =>
        [c.name, c.company, c.email, c.phone].some((v) => v?.toLowerCase().includes(q))
      )
    : contacts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{L.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            إدارة بيانات {L.title} والمعاملات المالية والمرفقات
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="ms-2 h-4 w-4" /> {L.addBtn}</Button>
          </DialogTrigger>
          <ContactFormDialog
            title={L.addBtn}
            onSubmit={(v) => create.mutate(v)}
            submitting={create.isPending}
          />
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={`ابحث عن ${L.single}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="pe-9" />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          لا يوجد {L.title} بعد
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((c) => (
            <Link key={c.id} to="/contacts/$contactId" params={{ contactId: c.id }}>
              <Card className="hover:border-primary transition-colors">
                <CardContent className="py-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-md bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    {c.company && <div className="text-xs text-muted-foreground truncate">{c.company}</div>}
                  </div>
                  <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                    {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>}
                    {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>}
                  </div>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContactFormDialog({
  title, initial, onSubmit, submitting,
}: {
  title: string;
  initial?: { name?: string; company?: string; email?: string; phone?: string; address?: string; tax_id?: string; notes?: string };
  onSubmit: (v: { name: string; company: string; email: string; phone: string; address: string; tax_id: string; notes: string }) => void;
  submitting?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [tax_id, setTaxId] = useState(initial?.tax_id ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) { toast.error("الاسم مطلوب"); return; }
          onSubmit({ name: name.trim(), company, email, phone, address, tax_id, notes });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>الاسم *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} />
          </div>
          <div><Label>الشركة</Label><Input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={200} /></div>
          <div><Label>الرقم الضريبي</Label><Input value={tax_id} onChange={(e) => setTaxId(e.target.value)} maxLength={50} /></div>
          <div><Label>البريد الإلكتروني</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><Label>الهاتف</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} /></div>
          <div className="col-span-2"><Label>العنوان</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} /></div>
          <div className="col-span-2"><Label>ملاحظات</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} /></div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={submitting}>حفظ</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
