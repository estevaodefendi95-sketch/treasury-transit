import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { productsQuery, insertRow, formatBRL, type Product } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/vendas/produtos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Produtos — SuaEmpresa Gestão" }] }),
  component: ProdutosPage,
});

function ProdutosPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: produtos = [] } = useQuery(productsQuery(companyId));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", sale_price: "", stock_quantity: "" });

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      return insertRow<Product>("products", {
        company_id: companyId,
        name: form.name,
        code: form.code || null,
        sale_price: Number(form.sale_price.replace(",", ".")) || 0,
        stock_quantity: Number(form.stock_quantity) || 0,
        is_active: true,
      } as unknown as Product);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", companyId] });
      toast.success("Produto criado");
      setOpen(false);
      setForm({ name: "", code: "", sale_price: "", stock_quantity: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produtos"
        description={`${produtos.length} cadastrado(s).`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Novo produto</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo produto</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Código</Label>
                    <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço (R$)</Label>
                    <Input value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estoque</Label>
                    <Input type="number" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
                  </div>
                </div>
                <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name} className="w-full">
                  {create.isPending ? "Salvando..." : "Criar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <Card>
        <CardHeader><CardTitle className="text-base">Catálogo</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {produtos.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Nenhum produto</TableCell></TableRow>
              )}
              {produtos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.code ?? "—"}</TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(Number(p.sale_price ?? 0))}</TableCell>
                  <TableCell className="text-right">{p.stock_quantity ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
