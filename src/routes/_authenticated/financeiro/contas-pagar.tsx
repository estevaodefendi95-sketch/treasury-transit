import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore, formatBRL, formatDateBR } from "@/store/useStore";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/financeiro/contas-pagar")({
  head: () => ({ meta: [{ title: "Contas a Pagar — SuaEmpresa Gestão" }] }),
  component: () => {
    const { contasPagar } = useAppStore();
    const total = contasPagar.filter((c) => c.status !== "pago").reduce((s, c) => s + c.valor, 0);
    return (
      <>
        <PageHeader title="Contas a Pagar" description={`Total pendente: ${formatBRL(total)}`} />
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contasPagar.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.fornecedor}</TableCell>
                    <TableCell>{c.descricao}</TableCell>
                    <TableCell>{c.categoria}</TableCell>
                    <TableCell>{formatDateBR(c.vencimento)}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "atrasado" ? "destructive" : c.status === "pago" ? "default" : "secondary"}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(c.valor)}</TableCell>
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
