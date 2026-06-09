import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useAuthStore } from "@/store/useStore";
import { useNavigate } from "@tanstack/react-router";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotificationGenerator } from "@/hooks/useNotificationGenerator";

export function AppLayout({ children }: { children: ReactNode }) {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, profile, company } = useCurrentCompany();
  useNotificationGenerator();

  const handleLogout = async () => {
    await qc.cancelQueries();
    qc.clear();
    await logout();
    navigate({ to: "/auth", replace: true });
  };

  const displayName = profile?.full_name ?? user?.email ?? "";
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <div className="hidden md:flex flex-col">
                <span className="text-sm font-semibold text-foreground">
                  {company?.name ?? "SuaEmpresa Gestão"}
                </span>
                <span className="text-[11px] text-muted-foreground">ERP financeiro</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-foreground">{displayName}</div>
                <div className="text-[11px] text-muted-foreground">{user?.email}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}

