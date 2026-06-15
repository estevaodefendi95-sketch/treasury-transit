import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, Search, Settings } from "lucide-react";
import { listCompanies, masterStats } from "@/lib/master.functions";
import {
  getAccessToken, PLAN_BADGE, PLAN_LABEL, STATUS_BADGE, STATUS_LABEL, formatCompanyDateBR,
} from "@/lib/master";

export const Route = createFileRoute("/_authenticated/master/empresas/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Empresas — Super Admin" }] }),
  component: EmpresasPage,
});

function EmpresasPage() {
  const listFn = useServerFn(listCompanies);
  const statsFn = useServerFn(masterStats);
  const [search, setSearch] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("todas");

  const companiesQ = useQuery({
    queryKey: ["master", "companies"],
    queryFn: async () => listFn({ data: { token: await getAccessToken() } }),
  });
  const statsQ = useQuery({
    queryKey: ["master", "stats"],
    queryFn: async () => statsFn({ data: { token: await getAccessToken() } }),
  });

  const filtered = useMemo(() => {
    const list = companiesQ.data ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((c) => {
      if (statusFiltro !== "todas" && c.status !== statusFiltro) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.cnpj ?? "").toLowerCase().includes(q) ||
        (c.admin_email ?? "").toLowerCase().includes(q)
      );
    });
  }, [companiesQ.data, search, statusFiltro]);

  const s = statsQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas"
        description="Gerencie todas as empresas da plataforma."
        actions={
          <Button asChild>
            <Link to="/master/empresas/nova"><Plus className="h-4 w-4" /> Nova Empresa</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total" value={s?.total} tone="" />
        <StatCard label="Ativas" value={s?.ativas} tone="text-green-600" />
        <StatCard label="Trial" value={s?.trial} tone="text-yellow-600" />
        <StatCard label="Suspensas" value={s?.suspensas} tone="text-red-600" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CNPJ ou admin..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todos os status</SelectItem>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="suspensa">Suspensa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {companiesQ.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : companiesQ.isError ? (
            <div className="py-12 text-center text-sm text-destructive">
              {(companiesQ.error as Error).message}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Building2 className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhuma empresa encontrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Segmento</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.cnpj || "—"}</TableCell>
                    <TableCell>{c.segment || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={PLAN_BADGE[c.plan ?? "free"] ?? ""}>
                        {PLAN_LABEL[c.plan ?? "free"] ?? c.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_BADGE[c.status ?? "trial"] ?? ""}>
                        {STATUS_LABEL[c.status ?? "trial"] ?? c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {c.admin_name || c.admin_email || "—"}
                      <div className="text-xs text-muted-foreground">{c.users_count} usuário(s)</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatCompanyDateBR(c.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="icon">
                        <Link to="/master/empresas/$id" params={{ id: c.id }}>
                          <Settings className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number | undefined; tone: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${tone}`}>{value ?? "—"}</div>
      </CardContent>
    </Card>
  );
}
