import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart3,
  Bell,
  Bot,
  ClipboardList,
  FileStack,
  Users,
} from "lucide-react";

const BASE = "https://inspect-flow-master.lovable.app";
const TITLE = "إدارة المشاريع التجارية — منصة المناقصات وإسناد المهام";
const DESC =
  "منصة عربية لإدارة المشاريع التجارية والمناقصات: قوالب مراحل قابلة للتخصيص، إسناد المهام، متابعة العوائق، تنبيهات فورية بالبريد وتيليجرام، ولوحة قيادة تنفيذية.";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: `${BASE}/` },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: `${BASE}/` }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "إدارة المشاريع التجارية",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          inLanguage: "ar",
          description: DESC,
          url: `${BASE}/`,
        }),
      },
    ],
  }),
  component: IndexPage,
});

const features = [
  {
    icon: FileStack,
    title: "مراحل وقوالب قابلة للتخصيص",
    text: "أنشئ قوالب سير عمل لكل نوع مشروع (مناقصة، أمر توريد، عقد) وطبّقها بضغطة واحدة.",
  },
  {
    icon: ClipboardList,
    title: "إسناد المهام والمواعيد",
    text: "أسند كل مهمة لموظف محدد بموعد نهائي، وتابع نسبة الإنجاز والمرفقات والتعليقات.",
  },
  {
    icon: Bell,
    title: "تنبيهات فورية",
    text: "إشعارات لحظية داخل النظام مع إرسال بالبريد الإلكتروني وتيليجرام عند الإسناد أو التأخير.",
  },
  {
    icon: BarChart3,
    title: "لوحة قيادة تنفيذية",
    text: "مؤشرات أداء ورسوم بيانية لحظية للمشاريع والمهام المتأخرة والعوائق المفتوحة.",
  },
  {
    icon: Users,
    title: "إدارة الموظفين والعملاء",
    text: "صلاحيات مدير وموظف، وسجل كامل للعملاء والموردين ومعاملاتهم.",
  },
  {
    icon: Bot,
    title: "مساعد ذكي",
    text: "تحليل بياناتك التشغيلية الحقيقية واقتراح إجراءات لإعادة توزيع المهام وتصعيد العوائق.",
  },
];

function IndexPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold text-foreground">إدارة المشاريع التجارية</span>
          <Button asChild size="sm" disabled={checking}>
            <Link to="/auth">تسجيل الدخول</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        <section className="py-16 text-center">
          <h1 className="text-3xl font-extrabold leading-tight text-foreground sm:text-5xl">
            منصة إدارة المشاريع التجارية والمناقصات
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            نظام تشغيلي عربي متكامل يربط المديرين بالموظفين: مراحل مشاريع قابلة للتخصيص، إسناد
            مهام بمواعيد نهائية، متابعة العوائق، وتنبيهات فورية حتى إنهاء كل عملية في وقتها.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/auth">ابدأ الآن</Link>
            </Button>
          </div>
        </section>

        <section className="pb-16">
          <h2 className="mb-6 text-center text-2xl font-bold text-foreground">
            ماذا يقدّم النظام؟
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="h-full">
                <CardContent className="pt-6">
                  <f.icon className="mb-3 h-6 w-6 text-primary" aria-hidden="true" />
                  <h3 className="mb-2 text-base font-semibold text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="pb-20">
          <h2 className="mb-4 text-2xl font-bold text-foreground">كيف تعمل دورة المشروع؟</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li>1. ينشئ المدير المشروع ويحدد نوعه (مناقصة، توريد، عقد) والعميل أو المورد.</li>
            <li>2. يطبّق قالب مراحل جاهزاً أو يبني مراحل مخصصة للمشروع.</li>
            <li>3. تُسند مهام كل مرحلة للموظفين بمواعيد نهائية ومرفقات.</li>
            <li>4. يسجّل الموظف تقدمه أو يرفع عائقاً يظهر مباشرة للإدارة لحلّه.</li>
            <li>5. تتابع الإدارة كل شيء من لوحة القيادة مع تنبيهات فورية.</li>
          </ol>
        </section>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        نظام إدارة المشاريع التجارية — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}
