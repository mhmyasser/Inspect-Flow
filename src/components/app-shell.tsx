import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  ListChecks,
  ListTodo,
  Settings,
  LogOut,
  Menu,
  X,
  Webhook,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { NotificationsBell } from "@/components/notifications-bell";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { to: "/projects", label: "المشاريع", icon: FolderKanban },
  { to: "/my-tasks", label: "مهامي", icon: ListTodo },
  { to: "/ai-assistant", label: "المساعد الذكي", icon: Sparkles },
  { to: "/employees", label: "الموظفون", icon: Users, adminOnly: true },
  { to: "/templates", label: "قوالب المراحل", icon: ListChecks, adminOnly: true },
  { to: "/webhooks", label: "Webhooks", icon: Webhook, adminOnly: true },
  { to: "/settings", label: "الإعدادات", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routerState = useRouterState();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = NAV.filter((n) => !n.adminOnly || role === "admin");

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-l border-border bg-sidebar">
        <SidebarContent
          items={items}
          activePath={routerState.location.pathname}
          userEmail={user?.email ?? ""}
          role={role}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-72 bg-sidebar border-l border-border">
            <SidebarContent
              items={items}
              activePath={routerState.location.pathname}
              userEmail={user?.email ?? ""}
              role={role}
              onSignOut={handleSignOut}
              onItemClick={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-card">
          <div className="font-semibold">إدارة المشاريع</div>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  items, activePath, userEmail, role, onSignOut, onItemClick,
}: {
  items: NavItem[];
  activePath: string;
  userEmail: string;
  role: "admin" | "employee" | null;
  onSignOut: () => void;
  onItemClick?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-5 border-b border-sidebar-border">
        <div className="text-lg font-bold text-sidebar-foreground">إدارة المشاريع</div>
        <div className="text-xs text-sidebar-foreground/60 mt-1">نظام إدارة العمليات التجارية</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = activePath === item.to || activePath.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onItemClick}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-2">
        <div className="px-3 py-2 text-xs text-sidebar-foreground/70 truncate">
          <div className="font-medium text-sidebar-foreground truncate">{userEmail}</div>
          <div>{role === "admin" ? "مدير" : "موظف"}</div>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}
