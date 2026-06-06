import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listEmployees, createEmployee, updateEmployee, deleteEmployee, resetEmployeePassword,
} from "@/lib/employees.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, KeyRound, Loader2, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/employees")({
  component: EmployeesPage,
});

interface Employee {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  telegram_chat_id: string | null;
  is_active: boolean;
  role: "admin" | "employee";
  created_at: string;
}

function EmployeesPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const list = useServerFn(listEmployees);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);

  if (role && role !== "admin") {
    navigate({ to: "/dashboard", replace: true });
    return null;
  }

  const { data: employees, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: () => list(),
  });

  const filtered = employees?.filter(
    (e) =>
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">إدارة الموظفين</h1>
          <p className="text-sm text-muted-foreground mt-1">إضافة وتعديل وحذف حسابات الموظفين والمديرين</p>
        </div>
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="ms-2 h-4 w-4" /> إضافة موظف</Button>
          </DialogTrigger>
          <CreateEmployeeDialog onClose={() => setOpenCreate(false)} onCreated={() => qc.invalidateQueries({ queryKey: ["employees"] })} />
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="بحث بالاسم أو البريد..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-3 pe-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : !filtered?.length ? (
            <div className="p-8 text-center text-muted-foreground">لا يوجد موظفون</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((emp) => (
                <div key={emp.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{emp.full_name}</span>
                      <Badge variant={emp.role === "admin" ? "default" : "secondary"}>
                        {emp.role === "admin" ? "مدير" : "موظف"}
                      </Badge>
                      {!emp.is_active && <Badge variant="destructive">معطّل</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1" dir="ltr">{emp.email}</div>
                    {emp.phone && <div className="text-xs text-muted-foreground" dir="ltr">{emp.phone}</div>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => setEditTarget(emp)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setResetTarget(emp)}>
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <DeleteEmployeeButton employee={emp} onDeleted={() => qc.invalidateQueries({ queryKey: ["employees"] })} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editTarget && (
        <EditEmployeeDialog
          employee={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["employees"] })}
        />
      )}
      {resetTarget && (
        <ResetPasswordDialog
          employee={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  );
}

function CreateEmployeeDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const create = useServerFn(createEmployee);
  const [form, setForm] = useState({ email: "", password: "", fullName: "", phone: "", role: "employee" as "admin" | "employee" });
  const mutation = useMutation({
    mutationFn: (data: typeof form) => create({ data: { ...data, phone: data.phone || null } }),
    onSuccess: () => { toast.success("تم إنشاء الموظف"); onCreated(); onClose(); },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>إضافة موظف جديد</DialogTitle>
        <DialogDescription>سيتم إنشاء حساب جديد بكلمة المرور المحددة</DialogDescription>
      </DialogHeader>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }}>
        <div className="space-y-2">
          <Label>الاسم الكامل</Label>
          <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>البريد الإلكتروني</Label>
          <Input required type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>رقم الموبايل</Label>
          <Input type="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+201234567890" />
        </div>
        <div className="space-y-2">
          <Label>كلمة المرور المبدئية</Label>
          <Input required type="password" minLength={8} dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>الدور</Label>
          <Select value={form.role} onValueChange={(v: "admin" | "employee") => setForm({ ...form, role: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="employee">موظف</SelectItem>
              <SelectItem value="admin">مدير</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
            إنشاء
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function EditEmployeeDialog({ employee, onClose, onSaved }: { employee: Employee; onClose: () => void; onSaved: () => void }) {
  const update = useServerFn(updateEmployee);
  const [form, setForm] = useState({
    fullName: employee.full_name,
    phone: employee.phone ?? "",
    telegramChatId: employee.telegram_chat_id ?? "",
    isActive: employee.is_active,
    role: employee.role,
  });
  const mutation = useMutation({
    mutationFn: () => update({ data: {
      id: employee.id,
      fullName: form.fullName,
      phone: form.phone || null,
      telegramChatId: form.telegramChatId || null,
      isActive: form.isActive,
      role: form.role,
    }}),
    onSuccess: () => { toast.success("تم حفظ التعديلات"); onSaved(); onClose(); },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تعديل بيانات الموظف</DialogTitle>
          <DialogDescription dir="ltr">{employee.email}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="space-y-2">
            <Label>الاسم الكامل</Label>
            <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>رقم الموبايل</Label>
            <Input type="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>رقم محادثة Telegram</Label>
            <Input dir="ltr" value={form.telegramChatId} onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })} placeholder="مثال: 123456789" />
            <p className="text-xs text-muted-foreground">يحصل عليه الموظف بكتابة /start للبوت</p>
          </div>
          <div className="space-y-2">
            <Label>الدور</Label>
            <Select value={form.role} onValueChange={(v: "admin" | "employee") => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">موظف</SelectItem>
                <SelectItem value="admin">مدير</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>الحساب مفعّل</Label>
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const reset = useServerFn(resetEmployeePassword);
  const [pwd, setPwd] = useState("");
  const mutation = useMutation({
    mutationFn: () => reset({ data: { id: employee.id, newPassword: pwd } }),
    onSuccess: () => { toast.success("تم تغيير كلمة المرور"); onClose(); },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
          <DialogDescription>{employee.full_name}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
          <div className="space-y-2">
            <Label>كلمة المرور الجديدة</Label>
            <Input required type="password" minLength={8} dir="ltr" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteEmployeeButton({ employee, onDeleted }: { employee: Employee; onDeleted: () => void }) {
  const del = useServerFn(deleteEmployee);
  const mutation = useMutation({
    mutationFn: () => del({ data: { id: employee.id } }),
    onSuccess: () => { toast.success("تم حذف الموظف"); onDeleted(); },
    onError: (err: Error) => toast.error(err.message),
  });
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>حذف الموظف نهائياً؟</AlertDialogTitle>
          <AlertDialogDescription>
            سيتم حذف حساب {employee.full_name} نهائياً وإلغاء إسناد مهامه المفتوحة. لا يمكن التراجع.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            حذف نهائي
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
