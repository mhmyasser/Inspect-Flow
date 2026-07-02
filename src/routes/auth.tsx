import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — إدارة المشاريع التجارية" },
      { name: "description", content: "سجّل الدخول إلى نظام إدارة المشاريع التجارية لمتابعة المهام والمناقصات والمراحل التشغيلية." },
      { property: "og:title", content: "تسجيل الدخول — إدارة المشاريع التجارية" },
      { property: "og:description", content: "سجّل الدخول إلى نظام إدارة المشاريع التجارية لمتابعة المهام والمناقصات والمراحل التشغيلية." },
      { property: "og:url", content: "https://work-wave-zen.lovable.app/auth" },
      { name: "twitter:title", content: "تسجيل الدخول — إدارة المشاريع التجارية" },
      { name: "twitter:description", content: "سجّل الدخول إلى نظام إدارة المشاريع التجارية." },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: "https://work-wave-zen.lovable.app/auth" }],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if any admin exists; if not, show setup form
    void fetch("/api/public/setup/admin-exists")
      .then((r) => r.json())
      .then((d: { exists: boolean }) => setAdminExists(d.exists))
      .catch(() => setAdminExists(true));

    // Redirect if already signed in
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast.error("فشل تسجيل الدخول", { description: "تأكد من البريد الإلكتروني وكلمة المرور" });
      return;
    }
    toast.success("تم تسجيل الدخول بنجاح");
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/public/setup/bootstrap-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, fullName: email.split("@")[0] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إنشاء المدير");
      toast.success("تم إنشاء حساب المدير. جاري تسجيل الدخول...");
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "حدث خطأ";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const isBootstrap = adminExists === false;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary to-accent/40 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle asChild className="text-2xl">
            <h1>{isBootstrap ? "إنشاء حساب المدير الأول" : "تسجيل الدخول"}</h1>
          </CardTitle>
          <CardDescription>
            {isBootstrap
              ? "هذا أول حساب في النظام وسيحصل على صلاحيات المدير"
              : "نظام إدارة المشاريع التجارية"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isBootstrap ? handleBootstrap : handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                required
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || adminExists === null}>
              {loading && <Loader2 className="ms-2 h-4 w-4 animate-spin" />}
              {isBootstrap ? "إنشاء حساب المدير" : "تسجيل الدخول"}
            </Button>
          </form>
          {!isBootstrap && adminExists !== null && (
            <p className="text-xs text-muted-foreground text-center mt-4">
              للموظفين الجدد: تواصل مع المدير لإنشاء حسابك
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
