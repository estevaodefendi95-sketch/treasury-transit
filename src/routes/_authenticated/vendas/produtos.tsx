import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore, formatBRL } from "@/store/useStore";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/vendas/produtos")({
  head: () => ({ meta: [{ title: "Produtos — SuaEmpresa Gestão" }] }),
  component: () => {
    const { produtos } = useAppStore();
    return (
      <>
        <PageHeader title="Produtos" description={`${produtos.length} produto(s) no catálogo`} />
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produtos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.sku ?? "-"}</TableCell>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>{p.categoria ?? "-"}</TableCell>
                    <TableCell className="text-right">{formatBRL(p.preco)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={p.estoque < 10 ? "destructive" : "secondary"}>{p.estoque} un.</Badge>
                    </TableCell>
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
