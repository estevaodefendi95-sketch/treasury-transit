import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { nameRulesQuery, deleteRow, formatDateBR } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/financeiro/regras-nomes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Regras de Nomes — SuaEmpresa Gestão" }] }),
  component: RegrasNomesPage,
});

function RegrasNomesPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: rules = [] } = useQuery(nameRulesQuery(companyId));

  const remove = useMutation({
    mutationFn: (id: string) => deleteRow("name_rules", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["name_rules", companyId] });
      toast.success("Regra removida");
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Regras de Nomes"
        description="Renomeações aprendidas a partir das suas edições. Aplicadas automaticamente em importações."
      />
      <Card>
        <CardHeader><CardTitle className="text-base">{rules.length} regra(s)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Padrão (substring)</TableHead>
                <TableHead>Nome sugerido</TableHead>
                <TableHead className="text-right">Aplicações</TableHead>
                <TableHead>Criada</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                    Nenhuma regra. Edite o nome de uma transação para criar a primeira.
                  </TableCell>
                </TableRow>
              )}
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.original_pattern}</TableCell>
                  <TableCell className="font-medium">{r.suggested_name}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">{r.times_applied ?? 0}</Badge>
                  </TableCell>
                  <TableCell>{formatDateBR(r.created_at)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove.mutate(r.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
