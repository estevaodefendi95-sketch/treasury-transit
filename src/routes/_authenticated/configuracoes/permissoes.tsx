import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Check, X, AlertTriangle } from "lucide-react";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { PERMISSIONS_MATRIX, ROLE_OPTIONS, ROLE_BADGE, ROLE_LABEL, type Role } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/configuracoes/permissoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Permissões — SuaEmpresa Gestão" }] }),
  component: PermissoesPage,
});

function PermissoesPage() {
  const { profile } = useCurrentCompany();
  if (profile && profile.role !== "admin") return <Navigate to="/dashboard" />;

  const renderCell = (val: string) => {
    if (val === "yes") return <Check className="h-4 w-4 text-green-600 mx-auto" />;
    if (val === "no") return <X className="h-4 w-4 text-red-500 mx-auto" />;
    if (val === "limit") return <AlertTriangle className="h-4 w-4 text-yellow-500 mx-auto" />;
    return <span className="text-xs font-medium">{val}</span>;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Matriz de Permissões"
        description="Referência das permissões por função — definidas no código, somente leitura"
      />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Recurso</TableHead>
                {ROLE_OPTIONS.map((r) => (
                  <TableHead key={r.value} className="text-center">
                    <Badge variant="outline" className={ROLE_BADGE[r.value as Role]}>
                      {ROLE_LABEL[r.value as Role]}
                    </Badge>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS_MATRIX.map((row) => (
                <TableRow key={row.feature}>
                  <TableCell className="font-medium">{row.feature}</TableCell>
                  {ROLE_OPTIONS.map((r) => (
                    <TableCell key={r.value} className="text-center">
                      {renderCell(row.values[r.value as Role])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2"><Check className="h-4 w-4 text-green-600" /> Permitido</div>
          <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-500" /> Com limite</div>
          <div className="flex items-center gap-2"><X className="h-4 w-4 text-red-500" /> Bloqueado</div>
        </CardContent>
      </Card>
    </div>
  );
}
