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
  transactionsQuery, customersQuery, insertRow, updateRow,
  formatBRL, formatDateBR, statusLabel, isOverdue, todayISO, type Transaction,
} from "@/lib/db";
import { PaymentMethodBadge } from "@/components/financeiro/PaymentMethodBadge";
import { RecurrenceBadge } from "@/components/financeiro/RecurrenceSelect";

export const Route = createFileRoute("/_authenticated/financeiro/contas-receber")({
  ssr: false,
  head: () => ({ meta: [{ title: "Contas a Receber — SuaEmpresa Gestão" }] }),
  component: ContasReceberPage,
});

function ContasReceberPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: all = [] } = useQuery(transactionsQuery(companyId));
  const { data: customers = [] } = useQuery(customersQuery(companyId));
  const contas = all.filter((t) => t.type === "income");
  const total = contas.filter((c) => c.status !== "received" && c.status !== "paid" && c.status !== "canceled").reduce((s, c) => s + Number(c.amount), 0);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", due_date: todayISO(), customer_id: "" });

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      return insertRow<Transaction>("transactions", {
        company_id: companyId,
        type: "income",
        status: "pending",
        description: form.description,
        amount: Number(form.amount.replace(",", ".")),
        due_date: form.due_date,
        customer_id: form.customer_id || null,
      } as unknown as Transaction);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      toast.success("Conta a receber criada");
      setOpen(false);
      setForm({ description: "", amount: "", due_date: todayISO(), customer_id: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markReceived = useMutation({
    mutationFn: async (id: string) =>
      updateRow<Transaction>("transactions", id, { status: "received", payment_date: todayISO() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      toast.success("Marcada como recebida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Receber"
        description={`Total em aberto: ${formatBRL(total)}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />Nova conta</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova conta a receber</DialogTitle></DialogHeader>
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
                  <Label>Cliente (opcional)</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={form.customer_id} onChange={(e) => setForm({ ...form, customer_id: e.target.value })}>
                    <option value="">—</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                    <TableCell className="font-medium">{c.description}</TableCell>
                    <TableCell>{formatDateBR(c.due_date)}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(Number(c.amount))}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "received" || c.status === "paid" ? "default" : overdue ? "destructive" : "secondary"}>
                        {overdue ? "Atrasado" : statusLabel(c.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {c.status !== "received" && c.status !== "paid" && (
                        <Button size="sm" variant="outline" onClick={() => markReceived.mutate(c.id)}>
                          <Check className="h-3 w-3 mr-1" />Receber
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
