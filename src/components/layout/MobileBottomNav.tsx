import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ArrowLeftRight, Calendar, Plus, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { setOpenMobile } = useSidebar();

  const items = [
    { to: "/dashboard" as const, icon: LayoutDashboard, label: "Início" },
    { to: "/financeiro/transacoes" as const, icon: ArrowLeftRight, label: "Lançar" },
    { to: "/financeiro/calendario" as const, icon: Calendar, label: "Agenda" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-card border-t border-border h-14 flex items-center justify-around safe-area-inset-bottom">
      {items.map((it) => {
        const active = pathname === it.to || pathname.startsWith(it.to);
        return (
          <Link
            key={it.to}
            to={it.to}
            className={cn(
              "flex flex-col items-center gap-0.5 text-[10px] flex-1 py-1",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <it.icon className="h-5 w-5" />
            <span>{it.label}</span>
          </Link>
        );
      })}
      <Link
        to="/financeiro/transacoes"
        search={{ new: 1 } as any}
        className="flex flex-col items-center gap-0.5 flex-1 py-1 text-primary"
      >
        <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center -mt-4 shadow-lg">
          <Plus className="h-5 w-5" />
        </div>
      </Link>
      <button
        onClick={() => setOpenMobile(true)}
        className="flex flex-col items-center gap-0.5 text-[10px] flex-1 py-1 text-muted-foreground"
      >
        <Menu className="h-5 w-5" />
        <span>Menu</span>
      </button>
    </nav>
  );
}
