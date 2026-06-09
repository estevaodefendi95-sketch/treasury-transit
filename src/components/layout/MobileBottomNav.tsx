import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, Calendar, Plus, Bell, Menu } from "lucide-react";
import { useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Upload, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { notificationsQuery } from "@/lib/db";

export function MobileBottomNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState(false);
  const { companyId } = useCurrentCompany();
  const { data: notifs = [] } = useQuery(notificationsQuery(companyId));
  const unread = notifs.filter((n: any) => !n.is_read).length;

  const items: Array<{
    to?: "/dashboard" | "/financeiro/calendario" | "/notificacoes";
    icon: any;
    label: string;
    onClick?: () => void;
    badge?: number;
  }> = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Início" },
    { to: "/financeiro/calendario", icon: Calendar, label: "Agenda" },
    { icon: Plus, label: "Novo", onClick: () => setSheet(true) },
    { to: "/notificacoes", icon: Bell, label: "Alertas", badge: unread },
    { icon: Menu, label: "Menu", onClick: () => setOpenMobile(true) },
  ];

  return (
    <>
      <nav className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-20 bg-card border-t border-border h-14 flex items-center justify-around">
        {items.map((it, idx) => {
          const active = it.to && (pathname === it.to || pathname.startsWith(it.to));
          const isPlus = it.label === "Novo";
          const content = (
            <>
              {isPlus ? (
                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center -mt-4 shadow-lg">
                  <it.icon className="h-5 w-5" />
                </div>
              ) : (
                <div className="relative">
                  <it.icon className="h-5 w-5" />
                  {it.badge != null && it.badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] flex items-center justify-center">
                      {it.badge > 9 ? "9+" : it.badge}
                    </span>
                  )}
                </div>
              )}
              {!isPlus && <span className="text-[10px]">{it.label}</span>}
            </>
          );
          const cls = cn(
            "flex flex-col items-center gap-0.5 flex-1 py-1",
            active ? "text-primary" : "text-muted-foreground",
          );
          if (it.to) {
            return (
              <Link key={idx} to={it.to} className={cls}>
                {content}
              </Link>
            );
          }
          return (
            <button key={idx} onClick={it.onClick} className={cls}>
              {content}
            </button>
          );
        })}
      </nav>

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Nova ação</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 mt-4">
            <Button
              variant="outline"
              className="justify-start h-12"
              onClick={() => { setSheet(false); navigate({ to: "/financeiro/contas-receber" }); }}
            >
              <ArrowDownCircle className="h-5 w-5 mr-2 text-emerald-600" /> Nova Receita
            </Button>
            <Button
              variant="outline"
              className="justify-start h-12"
              onClick={() => { setSheet(false); navigate({ to: "/financeiro/contas-pagar" }); }}
            >
              <ArrowUpCircle className="h-5 w-5 mr-2 text-rose-600" /> Nova Despesa
            </Button>
            <Button
              variant="outline"
              className="justify-start h-12"
              onClick={() => { setSheet(false); navigate({ to: "/financeiro/importar" }); }}
            >
              <Upload className="h-5 w-5 mr-2 text-primary" /> Importar Extrato
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
