import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  transactionsQuery, suppliersQuery, insertRow, updateRow,
  formatBRL, formatDateBR, statusLabel, isOverdue, todayISO, type Transaction,
} from "@/lib/db";
import { PaymentMethodBadge } from "@/components/financeiro/PaymentMethodBadge";
import { RecurrenceBadge } from "@/components/financeiro/RecurrenceSelect";

export const Route = createFileRoute("/_authenticated/financeiro/contas-pagar")({
  ssr: false,
  head: () => ({ meta: [{ title: "Contas a Pagar — SuaEmpresa Gestão" }] }),
  component: ContasPagarPage,
});

function ContasPagarPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: all = [] } = useQuery(transactionsQuery(companyId));
  const { data: suppliers = [] } = useQuery(suppliersQuery(companyId));
  const contas = all.filter((t) => t.type === "expense");
  const total = contas.filter((c) => c.status !== "paid" && c.status !== "canceled").reduce((s, c) => s + Number(c.amount), 0);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", due_date: todayISO(), supplier_id: "" });

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      return insertRow<Transaction>("transactions", {
        company_id: companyId,
        type: "expense",
        status: "pending",
        description: form.description,
        amount: Number(form.amount.replace(",", ".")),
        due_date: form.due_date,
        supplier_id: form.supplier_id || null,
      } as unknown as Transaction);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      toast.success("Conta a pagar criada");
      setOpen(false);
      setForm({ description: "", amount: "", due_date: todayISO(), supplier_id: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) =>
      updateRow<Transaction>("transactions", id, { status: "paid", payment_date: todayISO() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      toast.success("Marcada como paga");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Pagar"
        description={`Total em aberto: ${formatBRL(total)}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />Nova conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova conta a pagar</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Valor (R$)</Label>
                    <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Vencimento</Label>
                    <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fornecedor (opcional)</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.supplier_id} onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}>
                    <option value="">—</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
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
        <CardHeader><CardTitle className="text-base">Lançamentos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contas.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Nenhuma conta cadastrada</TableCell></TableRow>
              )}
              {contas.map((c) => {
                const overdue = isOverdue(c);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{c.description}</span>
                        <PaymentMethodBadge method={c.payment_method} />
                        <RecurrenceBadge tx={c} />
                      </div>
                    </TableCell>
                    <TableCell>{formatDateBR(c.due_date)}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(Number(c.amount))}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "paid" ? "default" : overdue ? "destructive" : "secondary"}>
                        {overdue ? "Atrasado" : statusLabel(c.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.status !== "paid" && (
                        <Button size="sm" variant="outline" onClick={() => markPaid.mutate(c.id)}>
                          <Check className="h-3 w-3 mr-1" />Pagar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
