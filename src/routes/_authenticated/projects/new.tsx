import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createProject } from "@/lib/projects.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/projects/new")({
  component: NewProjectPage,
});

function NewProjectPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const create = useServerFn(createProject);

  const [form, setForm] = useState({
    name: "",
    description: "",
    clientName: "",
    projectType: "tender" as "tender" | "direct",
    templateId: "",
    startDate: new Date().toISOString().slice(0, 10),
    expectedEndDate: "",
  });

  if (role && role !== "admin") {
    navigate({ to: "/dashboard", replace: true });
    return null;
  }

  const { data: templates } = useQuery({
    queryKey: ["templates", form.projectType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workflow_templates")
        .select("id, name, is_default")
        .eq("project_type", form.projectType)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: () => create({ data: {
      ...form,
      description: form.description || null,
      clientName: form.clientName || null,
      expectedEndDate: form.expectedEndDate || null,
      templateId: form.templateId || null,
    }}),
    onSuccess: (res) => {
      toast.success("تم إنشاء المشروع");
      navigate({ to: "/projects/$projectId", params: { projectId: res.id } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-bold mb-6">مشروع جديد</h1>
      <Card>
        <CardHeader>
          <CardTitle>بيانات المشروع</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
            <div className="space-y-2">
              <Label>اسم المشروع</Label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>العميل</Label>
              <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>وصف المشروع</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>نوع المشروع</Label>
                <Select value={form.projectType} onValueChange={(v: "tender" | "direct") => setForm({ ...form, projectType: v, templateId: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tender">مناقصة</SelectItem>
                    <SelectItem value="direct">أمر مباشر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>قالب المراحل</Label>
                <Select value={form.templateId} onValueChange={(v) => setForm({ ...form, templateId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر قالب" /></SelectTrigger>
                  <SelectContent>
                    {templates?.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}{t.is_default ? " (افتراضي)" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ البداية</Label>
                <Input type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>التاريخ المتوقع للانتهاء</Label>
                <Input type="date" value={form.expectedEndDate} onChange={(e) => setForm({ ...form, expectedEndDate: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate({ to: "/projects" })}>إلغاء</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
                إنشاء المشروع
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
