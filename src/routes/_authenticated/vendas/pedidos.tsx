import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { salesOrdersQuery, customersQuery, formatBRL, formatDateBR } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/vendas/pedidos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Pedidos — SuaEmpresa Gestão" }] }),
  component: PedidosPage,
});

function PedidosPage() {
  const { companyId } = useCurrentCompany();
  const { data: pedidos = [] } = useQuery(salesOrdersQuery(companyId));
  const { data: customers = [] } = useQuery(customersQuery(companyId));
  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? "—";
  const total = pedidos.reduce((s, p) => s + Number(p.total ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Pedidos de Venda" description={`${pedidos.length} pedido(s) • Total: ${formatBRL(total)}`} />
      <Card>
        <CardHeader><CardTitle className="text-base">Lista</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Nenhum pedido</TableCell></TableRow>
              )}
              {pedidos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">#{p.order_number}</TableCell>
                  <TableCell>{customerName(p.customer_id)}</TableCell>
                  <TableCell>{formatDateBR(p.issue_date)}</TableCell>
                  <TableCell><Badge variant="secondary">{p.status ?? "—"}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(Number(p.total ?? 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
