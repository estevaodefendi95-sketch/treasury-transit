import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  transactionsQuery, insertRow,
  formatBRL, formatDateBR, statusLabel, todayISO, type Transaction,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/financeiro/transacoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Transações — SuaEmpresa Gestão" }] }),
  component: TransacoesPage,
});

function TransacoesPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: transacoes = [] } = useQuery(transactionsQuery(companyId));

  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "income", description: "", amount: "", due_date: todayISO() });

  const filtered = transacoes.filter((t) =>
    t.description.toLowerCase().includes(filter.toLowerCase()),
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      return insertRow<Transaction>("transactions", {
        company_id: companyId,
        type: form.type,
        status: "pending",
        description: form.description,
        amount: Number(form.amount.replace(",", ".")),
        due_date: form.due_date,
      } as unknown as Transaction);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      toast.success("Transação criada");
      setOpen(false);
      setForm({ type: "income", description: "", amount: "", due_date: todayISO() });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transações"
        description="Todas as movimentações financeiras."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Nova</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova transação</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="income">Receita</option>
                    <option value="expense">Despesa</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>
                <Button onClick={() => create.mutate()} disabled={create.isPending || !form.description || !form.amount} className="w-full">
                  {create.isPending ? "Salvando..." : "Criar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Nenhuma transação</TableCell></TableRow>
              )}
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDateBR(t.payment_date ?? t.due_date)}</TableCell>
                  <TableCell className="font-medium">{t.description}</TableCell>
                  <TableCell>
                    <Badge variant={t.type === "income" ? "default" : "secondary"}>
                      {t.type === "income" ? "Receita" : "Despesa"}
                    </Badge>
                  </TableCell>
                  <TableCell>{statusLabel(t.status)}</TableCell>
                  <TableCell className={`text-right font-mono ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                    {t.type === "income" ? "+" : "-"} {formatBRL(Number(t.amount))}
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
