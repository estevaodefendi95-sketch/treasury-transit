import { createFileRoute, Outlet, redirect, Link, useRouterState } from "@tanstack/react-router";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { useAuthStore } from "@/store/useStore";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, FileText, BarChart3, Download, LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/contador")({
  ssr: false,
  component: ContadorLayout,
});

const ITEMS = [
  { to: "/contador/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { to: "/contador/lancamentos" as const, label: "Lançamentos", icon: FileText },
  { to: "/contador/relatorios" as const, label: "Relatórios", icon: BarChart3 },
  { to: "/contador/exportar" as const, label: "Exportar", icon: Download },
];

function ContadorLayout() {
  const { profile, company, user } = useCurrentCompany();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();

  // Permitir contador e admin
  const allowed = profile?.role === "contador" || profile?.role === "admin";

  if (profile && !allowed) {
    throw redirect({ to: "/dashboard" });
  }

  const handleLogout = async () => {
    await qc.cancelQueries();
    qc.clear();
    await logout();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background -m-4 md:-m-6">
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">SE</div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Área do Contador</span>
            <span className="text-[11px] text-muted-foreground">{company?.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium">{profile?.full_name ?? user?.email}</div>
            <div className="text-[11px] text-muted-foreground">somente leitura</div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <nav className="border-b border-border bg-card px-4 flex gap-1 overflow-x-auto">
        {ITEMS.map((it) => {
          const active = pathname.startsWith(it.to);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "px-3 py-3 text-sm flex items-center gap-2 border-b-2 transition",
                active ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <main className="flex-1 p-4 md:p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
