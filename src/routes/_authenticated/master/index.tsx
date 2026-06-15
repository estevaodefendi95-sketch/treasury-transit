import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Clock, Mail } from "lucide-react";
import { listCompanies, masterStats } from "@/lib/master.functions";
import {
  getAccessToken, STATUS_BADGE, STATUS_LABEL, formatCompanyDateBR,
} from "@/lib/master";

export const Route = createFileRoute("/_authenticated/master/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel Super Admin" }] }),
  component: MasterDashboard,
});

function MasterDashboard() {
  const listFn = useServerFn(listCompanies);
  const statsFn = useServerFn(masterStats);

  const statsQ = useQuery({
    queryKey: ["master", "stats"],
    queryFn: async () => statsFn({ data: { token: await getAccessToken() } }),
  });
  const companiesQ = useQuery({
    queryKey: ["master", "companies"],
    queryFn: async () => listFn({ data: { token: await getAccessToken() } }),
  });

  const s = statsQ.data;
  const companies = companiesQ.data ?? [];
  const recent = companies.slice(0, 6);
  const trials = companies.filter((c) => c.status === "trial");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel Super Admin"
        description="Visão geral da plataforma."
        actions={
          <Button asChild>
            <Link to="/master/empresas/nova"><Plus className="h-4 w-4" /> Nova Empresa</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Total de empresas" value={s?.total} />
        <Stat label="Ativas" value={s?.ativas} tone="text-green-600" />
        <Stat label="Em trial" value={s?.trial} tone="text-yellow-600" />
        <Stat label="Suspensas" value={s?.suspensas} tone="text-red-600" />
      </div>

      {trials.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50/50">
          <CardHeader className="flex flex-row items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-700" />
            <CardTitle className="text-base text-yellow-900">
              {trials.length} empresa(s) em período de trial
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {trials.map((c) => (
              <Button key={c.id} asChild variant="outline" size="sm">
                <Link to="/master/empresas/$id" params={{ id: c.id }}>{c.name}</Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Empresas recentes</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link to="/master/empresas">Ver todas</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {companiesQ.isLoading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Carregando…</div>
            ) : recent.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhuma empresa ainda.</div>
            ) : (
              recent.map((c) => (
                <Link
                  key={c.id}
                  to="/master/empresas/$id"
                  params={{ id: c.id }}
                  className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.admin_email || "sem admin"}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={STATUS_BADGE[c.status ?? "trial"] ?? ""}>
                      {STATUS_LABEL[c.status ?? "trial"] ?? c.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatCompanyDateBR(c.created_at)}</span>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Ações rápidas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full justify-start"><Link to="/master/empresas/nova"><Plus className="h-4 w-4" /> Nova empresa</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link to="/master/empresas"><Building2 className="h-4 w-4" /> Gerenciar empresas</Link></Button>
            <Button asChild variant="outline" className="w-full justify-start"><Link to="/master/convites"><Mail className="h-4 w-4" /> Convites pendentes</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | undefined; tone?: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone ?? ""}`}>{value ?? "—"}</div>
    </CardContent></Card>
  );
}
