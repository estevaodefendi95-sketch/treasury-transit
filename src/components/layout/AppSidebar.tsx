import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Calendar,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  FileBarChart,
  Sparkles,
  Gauge,
  Landmark,
  CreditCard,
  Upload,
  Settings,
  Bell,
  ClipboardCheck,
  Target,
  Tags,
  Receipt,
  Wand2,
  GitCompareArrows,
  Users,
  ShoppingCart,
  Package,
  ChevronDown,
  Building2,
  UserCircle,
  ShieldCheck,
  Palette,
} from "lucide-react";
import { Crown } from "lucide-react";
import { useState } from "react";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { useSuperAdmin } from "@/lib/master";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const lancamentosItems = [
  { title: "Contas a Receber", url: "/financeiro/contas-receber", icon: ArrowDownCircle },
  { title: "Contas a Pagar", url: "/financeiro/contas-pagar", icon: ArrowUpCircle },
];

const analisesItems = [
  { title: "Fluxo de Caixa", url: "/financeiro/fluxo-caixa", icon: TrendingUp },
  { title: "DRE", url: "/relatorios", icon: FileBarChart },
  { title: "Previsões", url: "/projecao", icon: Sparkles },
  { title: "Indicadores", url: "/analises/indicadores", icon: Gauge },
];

const cadastrosItems = [
  { title: "Categorias", url: "/financeiro/categorias", icon: Tags },
  { title: "Centros de Custo", url: "/centros-de-custo", icon: Building2 },
  { title: "Orçamento", url: "/orcamento", icon: Target },
  { title: "Conciliação", url: "/financeiro/conciliacao", icon: GitCompareArrows },
  { title: "Regras de Nomes", url: "/financeiro/regras-nomes", icon: Wand2 },
  { title: "Importar NF-e", url: "/financeiro/importar-nfe", icon: Receipt },
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
  const { isSuperAdmin } = useSuperAdmin();
  const isAdmin = profile?.role === "admin";
  const isActive = (url: string) => pathname === url;
  const isInGroup = (items: { url: string }[]) =>
    items.some((i) => pathname.startsWith(i.url));

  const [openCadastros, setOpenCadastros] = useState(isInGroup(cadastrosItems));
  const [openVendas, setOpenVendas] = useState(isInGroup(vendasItems));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent translate="no">
        <div className="px-3 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
              SE
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold leading-tight text-sidebar-foreground">
                  SuaEmpresa
                </span>
                <span className="text-[10px] text-muted-foreground">Gestão ERP</span>
              </div>
            )}
          </div>
        </div>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-amber-600 font-semibold flex items-center gap-1">
              <Crown className="h-3.5 w-3.5" /> Super Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <Item url="/master" icon={Crown} title="Painel" pathname={pathname} collapsed={collapsed} />
                <Item url="/master/empresas" icon={Building2} title="Empresas" pathname={pathname} collapsed={collapsed} />
                <Item url="/master/convites" icon={Bell} title="Convites" pathname={pathname} collapsed={collapsed} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
          <SidebarGroupLabel>Geral</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Item url="/dashboard" icon={LayoutDashboard} title="Dashboard" pathname={pathname} collapsed={collapsed} />
              <Item url="/financeiro/calendario" icon={Calendar} title="Calendário de Caixa" pathname={pathname} collapsed={collapsed} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Lançamentos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {lancamentosItems.map((i) => (
                <Item key={i.url} {...i} pathname={pathname} collapsed={collapsed} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-primary font-semibold">
            Análises
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analisesItems.map((i) => (
                <Item key={i.url} {...i} pathname={pathname} collapsed={collapsed} highlight />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Contas</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Item url="/financeiro/contas-bancarias" icon={Landmark} title="Contas Bancárias" pathname={pathname} collapsed={collapsed} />
              <Item url="/financeiro/cartoes" icon={CreditCard} title="Cartões" pathname={pathname} collapsed={collapsed} />
              <Item url="/financeiro/importar" icon={Upload} title="Importar Extrato" pathname={pathname} collapsed={collapsed} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible
                open={openCadastros || collapsed}
                onOpenChange={setOpenCadastros}
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isInGroup(cadastrosItems)}>
                      <Tags className="h-4 w-4" />
                      {!collapsed && (
                        <>
                          <span>Cadastros e Regras</span>
                          <ChevronDown
                            className={cn(
                              "ml-auto h-4 w-4 transition-transform",
                              openCadastros && "rotate-180",
                            )}
                          />
                        </>
                      )}
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  {!collapsed && (
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {cadastrosItems.map((item) => (
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

              <Collapsible
                open={openVendas || collapsed}
                onOpenChange={setOpenVendas}
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isInGroup(vendasItems)}>
                      <ShoppingCart className="h-4 w-4" />
                      {!collapsed && (
                        <>
                          <span>Vendas</span>
                          <ChevronDown
                            className={cn(
                              "ml-auto h-4 w-4 transition-transform",
                              openVendas && "rotate-180",
                            )}
                          />
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

        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Item url="/notificacoes" icon={Bell} title="Notificações" pathname={pathname} collapsed={collapsed} />
              <ConfigGroup collapsed={collapsed} pathname={pathname} isAdmin={isAdmin} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function ConfigGroup({ collapsed, pathname, isAdmin }: { collapsed: boolean; pathname: string; isAdmin: boolean }) {
  const items = [
    { title: "Perfil", url: "/configuracoes/perfil", icon: UserCircle, show: true },
    { title: "Usuários", url: "/configuracoes/usuarios", icon: Users, show: isAdmin },
    { title: "Permissões", url: "/configuracoes/permissoes", icon: ShieldCheck, show: isAdmin },
    { title: "Personalização", url: "/configuracoes", icon: Palette, show: true },
    { title: "Notificações", url: "/configuracoes/notificacoes", icon: Bell, show: true },
    { title: "Aprovações", url: "/configuracoes/aprovacoes", icon: ClipboardCheck, show: isAdmin },
  ].filter((i) => i.show);
  const inGroup = pathname.startsWith("/configuracoes");
  const [open, setOpen] = useState(inGroup);
  return (
    <Collapsible open={open || collapsed} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton isActive={inGroup}>
            <Settings className="h-4 w-4" />
            {!collapsed && (
              <>
                <span>Configurações</span>
                <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", open && "rotate-180")} />
              </>
            )}
          </SidebarMenuButton>
        </CollapsibleTrigger>
        {!collapsed && (
          <CollapsibleContent>
            <SidebarMenuSub>
              {items.map((item) => (
                <SidebarMenuSubItem key={item.url}>
                  <SidebarMenuSubButton asChild isActive={pathname === item.url}>
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
  );
}

function Item({
  url,
  icon: Icon,
  title,
  pathname,
  collapsed,
  highlight = false,
}: {
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  pathname: string;
  collapsed: boolean;
  highlight?: boolean;
}) {
  const active = pathname === url || pathname.startsWith(url + "/");
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active}>
        <Link to={url} className={highlight ? "font-medium" : undefined}>
          <Icon className="h-4 w-4" />
          {!collapsed && <span>{title}</span>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
