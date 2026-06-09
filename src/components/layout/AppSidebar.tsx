import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Wallet,
  Calendar,
  ArrowLeftRight,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  GitCompareArrows,
  Users,
  ShoppingCart,
  Package,
  ChevronDown,
  Tags,
  Upload,
  Wand2,
  Landmark,
  CreditCard,
  Building2,
  Bell,
  ClipboardCheck,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const financeiroItems = [
  { title: "Calendário", url: "/financeiro/calendario", icon: Calendar },
  { title: "Transações", url: "/financeiro/transacoes", icon: ArrowLeftRight },
  { title: "Contas Bancárias", url: "/financeiro/contas-bancarias", icon: Landmark },
  { title: "Cartões", url: "/financeiro/cartoes", icon: CreditCard },
  { title: "Contas a Pagar", url: "/financeiro/contas-pagar", icon: ArrowUpCircle },
  { title: "Contas a Receber", url: "/financeiro/contas-receber", icon: ArrowDownCircle },
  { title: "Fluxo de Caixa", url: "/financeiro/fluxo-caixa", icon: TrendingUp },
  { title: "Categorias", url: "/financeiro/categorias", icon: Tags },
  { title: "Centros de Custo", url: "/centros-de-custo", icon: Building2 },
  { title: "Importar Extrato", url: "/financeiro/importar", icon: Upload },
  { title: "Regras de Nomes", url: "/financeiro/regras-nomes", icon: Wand2 },
  { title: "Conciliação", url: "/financeiro/conciliacao", icon: GitCompareArrows },
];

const vendasItems = [
  { title: "Clientes", url: "/vendas/clientes", icon: Users },
  { title: "Pedidos", url: "/vendas/pedidos", icon: ShoppingCart },
  { title: "Produtos", url: "/vendas/produtos", icon: Package },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { profile } = useCurrentCompany();
  const isAdmin = profile?.role === "admin";
  const isActive = (url: string) => pathname === url;
  const isInGroup = (items: { url: string }[]) => items.some((i) => pathname.startsWith(i.url));

  const [openFin, setOpenFin] = useState(isInGroup(financeiroItems));
  const [openVendas, setOpenVendas] = useState(isInGroup(vendasItems));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-3 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
              SE
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-tight text-sidebar-foreground">SuaEmpresa</span>
                <span className="text-[10px] text-muted-foreground">Gestão ERP</span>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/dashboard")}>
                  <Link to="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    {!collapsed && <span>Dashboard</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/notificacoes")}>
                  <Link to="/notificacoes">
                    <Bell className="h-4 w-4" />
                    {!collapsed && <span>Notificações</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/relatorios")}>
                  <Link to="/relatorios">
                    <BarChart3 className="h-4 w-4" />
                    {!collapsed && <span>Relatórios</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/projecao")}>
                  <Link to="/projecao">
                    <Sparkles className="h-4 w-4" />
                    {!collapsed && <span>Projeção IA</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/aprovacoes")}>
                    <Link to="/aprovacoes">
                      <ClipboardCheck className="h-4 w-4" />
                      {!collapsed && <span>Aprovações</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>

          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible open={openFin || collapsed} onOpenChange={setOpenFin} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isInGroup(financeiroItems)}>
                      <Wallet className="h-4 w-4" />
                      {!collapsed && (
                        <>
                          <span>Financeiro</span>
                          <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", openFin && "rotate-180")} />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {financeiroItems.map((item) => (
                          <SidebarMenuSubItem key={item.url}>
                            <SidebarMenuSubButton asChild isActive={isActive(item.url)}>
                              <Link to={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  )}
                </SidebarMenuItem>
              </Collapsible>

              <Collapsible open={openVendas || collapsed} onOpenChange={setOpenVendas} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isInGroup(vendasItems)}>
                      <ShoppingCart className="h-4 w-4" />
                      {!collapsed && (
                        <>
                          <span>Vendas</span>
                          <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", openVendas && "rotate-180")} />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {vendasItems.map((item) => (
                          <SidebarMenuSubItem key={item.url}>
                            <SidebarMenuSubButton asChild isActive={isActive(item.url)}>
                              <Link to={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  )}
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
