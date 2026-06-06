import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({ fullName: "", phone: "", telegramChatId: "" });
  useEffect(() => {
    if (profile) setForm({
      fullName: profile.full_name,
      phone: profile.phone ?? "",
      telegramChatId: profile.telegram_chat_id ?? "",
    });
  }, [profile]);

  const updateM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        full_name: form.fullName,
        phone: form.phone || null,
        telegram_chat_id: form.telegramChatId || null,
      }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["my-profile"] }); },
    onError: (err: Error) => toast.error(err.message),
  });

  const [newPwd, setNewPwd] = useState("");
  const pwdM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم تغيير كلمة المرور"); setNewPwd(""); },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">الإعدادات الشخصية</h1>
        <p className="text-sm text-muted-foreground mt-1">تعديل بياناتك وتغيير كلمة المرور</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>بياناتك</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); updateM.mutate(); }}>
            <div className="space-y-2">
              <Label>الاسم الكامل</Label>
              <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input dir="ltr" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>رقم الموبايل</Label>
              <Input type="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+201234567890" />
            </div>
            <div className="space-y-2">
              <Label>رقم محادثة Telegram</Label>
              <Input dir="ltr" value={form.telegramChatId} onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                لاستلام التنبيهات على تليجرام: ابحث عن بوت الشركة في تليجرام واكتب له <code dir="ltr">/start</code>،
                ثم انسخ رقم المحادثة الذي يعطيك إياه والصقه هنا.
              </p>
            </div>
            <Button type="submit" disabled={updateM.isPending}>
              {updateM.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              حفظ البيانات
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تغيير كلمة المرور</CardTitle>
          <CardDescription>اختر كلمة مرور قوية لا تقل عن 8 أحرف</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); pwdM.mutate(); }}>
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة</Label>
              <Input required type="password" minLength={8} dir="ltr" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
            </div>
            <Button type="submit" disabled={pwdM.isPending}>
              {pwdM.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              تغيير كلمة المرور
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
