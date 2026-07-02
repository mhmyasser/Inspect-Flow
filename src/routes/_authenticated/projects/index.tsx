import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/projects/")({
  component: ProjectsListPage,
});

function ProjectsListPage() {
  const { role } = useAuth();
  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, client_name, project_type, status, start_date, expected_end_date")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">المشاريع</h1>
          <p className="text-sm text-muted-foreground mt-1">قائمة كل المشاريع</p>
        </div>
        {role === "admin" && (
          <Button asChild>
            <Link to="/projects/new"><Plus className="ms-2 h-4 w-4" /> مشروع جديد</Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">جاري التحميل...</p>
      ) : !projects?.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FolderKanban className="h-12 w-12 mx-auto mb-3 opacity-40" />
            لا توجد مشاريع بعد
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} to="/projects/$projectId" params={{ projectId: p.id }}>
              <Card className="hover:border-primary transition-colors h-full">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-base">{p.name}</h2>
                    <Badge variant={p.project_type === "tender" ? "default" : "secondary"}>
                      {p.project_type === "tender" ? "مناقصة" : "مباشر"}
                    </Badge>
                  </div>
                  {p.client_name && <p className="text-sm text-muted-foreground">{p.client_name}</p>}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
                    <span>بداية: {new Date(p.start_date).toLocaleDateString("ar-EG")}</span>
                    <Badge variant="outline">
                      {p.status === "active" ? "نشط" : p.status === "completed" ? "مكتمل" : p.status === "cancelled" ? "ملغي" : "متوقف"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
