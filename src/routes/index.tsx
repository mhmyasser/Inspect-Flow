import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إدارة المشاريع التجارية — منصة متكاملة للمناقصات والمهام" },
      { name: "description", content: "منصة تشغيلية لإدارة المشاريع التجارية والمناقصات، وإسناد المهام، وتتبع المراحل، وإرسال التنبيهات للفريق." },
      { property: "og:title", content: "إدارة المشاريع التجارية — منصة متكاملة" },
      { property: "og:description", content: "منصة تشغيلية لإدارة المشاريع التجارية والمناقصات وإسناد المهام وتتبع المراحل." },
      { property: "og:url", content: "https://work-wave-zen.lovable.app/" },
      { name: "twitter:title", content: "إدارة المشاريع التجارية" },
      { name: "twitter:description", content: "منصة تشغيلية لإدارة المشاريع التجارية وإسناد المهام." },
    ],
    links: [{ rel: "canonical", href: "https://work-wave-zen.lovable.app/" }],
  }),
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();
  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      navigate({ to: data.user ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
