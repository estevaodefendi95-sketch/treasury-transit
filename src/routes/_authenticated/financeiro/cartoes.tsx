import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, ChevronLeft, ChevronRight, AlertTriangle, CreditCard as CardIcon } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  creditCardsQuery, transactionsQuery, bankAccountsQuery,
  insertRow, updateRow, formatBRL, formatDateBR, todayISO,
  type CreditCard,
} from "@/lib/db";
import { CARD_BRANDS } from "@/lib/payment";
import { maskCardNumber, computeCardSpending, billingCycle } from "@/lib/accounts";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/financeiro/cartoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Cartões — SuaEmpresa Gestão" }] }),
  component: CartoesPage,
});

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#1e293b"];

function CartoesPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: cards = [] } = useQuery(creditCardsQuery(companyId));
  const { data: transactions = [] } = useQuery(transactionsQuery(companyId));
  const { data: accounts = [] } = useQuery(bankAccountsQuery(companyId));

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<CreditCard | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const today = new Date();
  const [cycleYear, setCycleYear] = useState(today.getFullYear());
  const [cycleMonth, setCycleMonth] = useState(today.getMonth() + 1);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", account: "", date: todayISO() });

  const [form, setForm] = useState({
    name: "", brand: "visa", last_four_digits: "",
    credit_limit: "", closing_day: "1", due_day: "10", color: COLORS[0],
  });

  const resetForm = () => {
    setForm({ name: "", brand: "visa", last_four_digits: "", credit_limit: "", closing_day: "1", due_day: "10", color: COLORS[0] });
    setEditing(null);
  };

  const openEdit = (c: CreditCard) => {
    setEditing(c);
    setForm({
      name: c.name,
      brand: c.brand ?? "visa",
      last_four_digits: c.last_four_digits ?? "",
      credit_limit: String(c.credit_limit ?? ""),
      closing_day: String(c.closing_day ?? 1),
      due_day: String(c.due_day ?? 10),
      color: c.color ?? COLORS[0],
    });
    setOpenForm(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      const payload = {
        company_id: companyId,
        name: form.name,
        brand: form.brand,
        last_four_digits: form.last_four_digits.replace(/\D/g, "").slice(0, 4) || null,
        credit_limit: form.credit_limit ? Number(form.credit_limit.replace(",", ".")) : null,
        closing_day: Number(form.closing_day) || null,
        due_day: Number(form.due_day) || null,
        color: form.color,
      };
      if (editing) return updateRow<CreditCard>("credit_cards", editing.id, payload as Partial<CreditCard>);
      return insertRow<CreditCard>("credit_cards", payload as unknown as CreditCard);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credit_cards", companyId] });
      toast.success(editing ? "Cartão atualizado" : "Cartão criado");
      setOpenForm(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cardsWithSpending = useMemo(() => {
    return cards.map((c) => {
      const cycle = billingCycle(c.closing_day ?? 1, cycleYear, cycleMonth);
      const spent = computeCardSpending(c.id, transactions, cycle);
      const limit = Number(c.credit_limit ?? 0);
      const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
      return { ...c, _spent: spent, _pct: pct, _cycle: cycle };
    });
  }, [cards, transactions, cycleYear, cycleMonth]);

  const selectedCard = selectedCardId ? cardsWithSpending.find((c) => c.id === selectedCardId) : null;
  const invoiceTxs = selectedCard
    ? transactions
        .filter(
          (t) =>
            t.credit_card_id === selectedCard.id &&
            t.type === "expense" &&
            t.due_date >= selectedCard._cycle.startISO &&
            t.due_date <= selectedCard._cycle.endISO,
        )
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
    : [];
  const invoiceTotal = invoiceTxs.reduce((s, t) => s + Number(t.amount), 0);

  const navMonth = (delta: number) => {
    let y = cycleYear;
    let m = cycleMonth + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setCycleYear(y);
    setCycleMonth(m);
  };

  const payInvoice = async () => {
    if (!companyId || !selectedCard) return;
    const amount = Number(payForm.amount.replace(",", "."));
    if (!amount || !payForm.account) {
      toast.error("Preencha valor e conta");
      return;
    }
    const { error } = await supabase.from("transactions").insert({
      company_id: companyId,
      type: "expense",
      status: "paid",
      description: `Pagamento fatura ${selectedCard.name} (${String(cycleMonth).padStart(2, "0")}/${cycleYear})`,
      amount,
      due_date: payForm.date,
      payment_date: payForm.date,
      bank_account_id: payForm.account,
      payment_method: "credito",
      card_brand: selectedCard.brand,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Pagamento de fatura registrado");
    qc.invalidateQueries({ queryKey: ["transactions", companyId] });
    setPayOpen(false);
    setPayForm({ amount: "", account: "", date: todayISO() });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cartões de Crédito"
        description="Cadastre e acompanhe faturas dos cartões."
        actions={
          <Dialog open={openForm} onOpenChange={(v) => { setOpenForm(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Novo Cartão</Button></DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{editing ? "Editar Cartão" : "Novo Cartão"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Nubank Visa" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Bandeira</Label>
                    <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}>
                      {CARD_BRANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label>Final (4 dígitos)</Label>
                    <Input value={form.last_four_digits} maxLength={4}
                      onChange={(e) => setForm({ ...form, last_four_digits: e.target.value.replace(/\D/g, "") })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Limite (R$)</Label>
                  <Input value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Dia fechamento</Label>
                    <Input type="number" min={1} max={31} value={form.closing_day}
                      onChange={(e) => setForm({ ...form, closing_day: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Dia vencimento</Label>
                    <Input type="number" min={1} max={31} value={form.due_day}
                      onChange={(e) => setForm({ ...form, due_day: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Cor</Label>
                  <div className="flex gap-2">
                    {COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                        className="h-7 w-7 rounded-full border-2"
                        style={{ backgroundColor: c, borderColor: form.color === c ? "#000" : "transparent" }} />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
                <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>
                  {save.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Lista de cartões */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cardsWithSpending.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum cartão cadastrado.
            </CardContent>
          </Card>
        )}
        {cardsWithSpending.map((c) => {
          const isOver = c._pct >= 100;
          const isWarning = c._pct >= 80 && !isOver;
          const brandLabel = CARD_BRANDS.find((b) => b.value === c.brand)?.label ?? c.brand;
          return (
            <Card
              key={c.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${selectedCardId === c.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelectedCardId(c.id)}
            >
              <CardContent className="p-4 space-y-3">
                <div
                  className="rounded-lg p-3 text-white"
                  style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)` }}
                >
                  <div className="flex items-center justify-between">
                    <CardIcon className="h-5 w-5 opacity-80" />
                    <span className="text-xs uppercase font-semibold">{brandLabel}</span>
                  </div>
                  <div className="mt-3 font-mono text-sm tracking-wider">{maskCardNumber(c.last_four_digits)}</div>
                  <div className="mt-1 text-xs">{c.name}</div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{formatBRL(c._spent)} usado</span>
                    <span className="text-muted-foreground">de {formatBRL(c.credit_limit ?? 0)}</span>
                  </div>
                  <Progress value={c._pct} className={isOver ? "[&>div]:bg-rose-600" : isWarning ? "[&>div]:bg-amber-500" : ""} />
                  {(isWarning || isOver) && (
                    <Badge variant={isOver ? "destructive" : "secondary"} className="text-[10px] gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {isOver ? "Limite atingido" : `${Math.round(c._pct)}% usado`}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  <Badge variant="outline">Fech. dia {c.closing_day}</Badge>
                  <Badge variant="outline">Venc. dia {c.due_day}</Badge>
                </div>
                <Button size="sm" variant="ghost" className="h-7" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>
                  <Pencil className="h-3 w-3 mr-1" />Editar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Fatura do cartão selecionado */}
      {selectedCard && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Fatura — {selectedCard.name}</CardTitle>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navMonth(-1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium w-24 text-center">
                  {String(cycleMonth).padStart(2, "0")}/{cycleYear}
                </span>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => navMonth(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Ciclo: {formatDateBR(selectedCard._cycle.startISO)} → {formatDateBR(selectedCard._cycle.endISO)}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoiceTxs.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">Sem lançamentos neste ciclo.</div>
            ) : (
              <div className="space-y-1">
                {invoiceTxs.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm py-1.5 border-b">
                    <div>
                      <div className="font-medium">{t.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateBR(t.due_date)}
                        {t.installment_number && t.total_installments && (
                          <span> · Parcela {t.installment_number}/{t.total_installments}</span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-rose-600">- {formatBRL(Number(t.amount))}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="font-semibold">Total da fatura</span>
              <span className="font-mono font-bold text-lg">{formatBRL(invoiceTotal)}</span>
            </div>
            <Button
              className="w-full"
              disabled={invoiceTotal === 0}
              onClick={() => { setPayForm({ amount: String(invoiceTotal), account: accounts[0]?.id ?? "", date: todayISO() }); setPayOpen(true); }}
            >
              Pagar fatura
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pagar fatura</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Valor</Label>
              <Input value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Conta de origem</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={payForm.account} onChange={(e) => setPayForm({ ...payForm, account: e.target.value })}>
                <option value="">—</option>
                {accounts.filter((a) => a.is_active !== false).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button onClick={payInvoice}>Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
