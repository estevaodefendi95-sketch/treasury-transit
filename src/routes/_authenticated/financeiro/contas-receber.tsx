import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore, formatBRL, formatDateBR } from "@/store/useStore";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/financeiro/contas-receber")({
  head: () => ({ meta: [{ title: "Contas a Receber — SuaEmpresa Gestão" }] }),
  component: () => {
    const { contasReceber } = useAppStore();
    const total = contasReceber.filter((c) => c.status !== "recebido").reduce((s, c) => s + c.valor, 0);
    return (
      <>
        <PageHeader title="Contas a Receber" description={`Total previsto: ${formatBRL(total)}`} />
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contasReceber.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.cliente}</TableCell>
                    <TableCell>{c.descricao}</TableCell>
                    <TableCell>{formatDateBR(c.vencimento)}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "atrasado" ? "destructive" : c.status === "recebido" ? "default" : "secondary"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatBRL(c.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </>
    );
  },
});
