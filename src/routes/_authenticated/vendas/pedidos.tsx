import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore, formatBRL, formatDateBR } from "@/store/useStore";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/vendas/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — SuaEmpresa Gestão" }] }),
  component: () => {
    const { pedidos } = useAppStore();
    const total = pedidos.filter((p) => p.status === "faturado").reduce((s, p) => s + p.total, 0);
    return (
      <>
        <PageHeader title="Pedidos" description={`Total faturado: ${formatBRL(total)}`} />
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">#{p.numero}</TableCell>
                    <TableCell>{p.cliente}</TableCell>
                    <TableCell>{formatDateBR(p.data)}</TableCell>
                    <TableCell>
                      <Badge variant={p.status === "faturado" ? "default" : p.status === "cancelado" ? "destructive" : "secondary"}>
                        {p.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{formatBRL(p.total)}</TableCell>
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
