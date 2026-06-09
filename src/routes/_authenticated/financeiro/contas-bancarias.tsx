import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Archive, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  bankAccountsQuery, transactionsQuery, insertRow, updateRow, formatBRL, type BankAccount,
} from "@/lib/db";
import { maskAccountNumber, computeAccountBalance, buildBalanceHistory } from "@/lib/accounts";
import { TransferModal } from "@/components/financeiro/TransferModal";

export const Route = createFileRoute("/_authenticated/financeiro/contas-bancarias")({
  ssr: false,
  head: () => ({ meta: [{ title: "Contas Bancárias — SuaEmpresa Gestão" }] }),
  component: ContasBancariasPage,
});

const COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#64748b"];

function ContasBancariasPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery(bankAccountsQuery(companyId));
  const { data: transactions = [] } = useQuery(transactionsQuery(companyId));

  const activeAccounts = accounts.filter((a) => a.is_active !== false);
  const accountsWithBalance = useMemo(
    () => accounts.map((a) => ({ ...a, _balance: computeAccountBalance(a, transactions) })),
    [accounts, transactions],
  );
  const totalBalance = accountsWithBalance
    .filter((a) => a.is_active !== false)
    .reduce((s, a) => s + a._balance, 0);

  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [chartAccountId, setChartAccountId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", bank_name: "", agency: "", account_number: "",
    initial_balance: "", minimum_balance: "", color: COLORS[0], is_active: true,
  });

  const resetForm = () => {
    setForm({ name: "", bank_name: "", agency: "", account_number: "", initial_balance: "", minimum_balance: "", color: COLORS[0], is_active: true });
    setEditing(null);
  };

  const openEdit = (a: BankAccount) => {
    setEditing(a);
    setForm({
      name: a.name,
      bank_name: a.bank_name ?? "",
      agency: a.agency ?? "",
      account_number: a.account_number ?? "",
      initial_balance: String(a.initial_balance ?? a.balance ?? ""),
      minimum_balance: String(a.minimum_balance ?? ""),
      color: a.color ?? COLORS[0],
      is_active: a.is_active !== false,
    });
    setOpenForm(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      const payload = {
        company_id: companyId,
        name: form.name,
        bank_name: form.bank_name || null,
        agency: form.agency || null,
        account_number: form.account_number || null,
        initial_balance: form.initial_balance ? Number(form.initial_balance.replace(",", ".")) : 0,
        minimum_balance: form.minimum_balance ? Number(form.minimum_balance.replace(",", ".")) : null,
        color: form.color,
        is_active: form.is_active,
      };
      if (editing) {
        return updateRow<BankAccount>("bank_accounts", editing.id, payload as Partial<BankAccount>);
      }
      return insertRow<BankAccount>("bank_accounts", payload as unknown as BankAccount);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
      toast.success(editing ? "Conta atualizada" : "Conta criada");
      setOpenForm(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: (a: BankAccount) =>
      updateRow<BankAccount>("bank_accounts", a.id, { is_active: !a.is_active }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
      toast.success("Conta atualizada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const chartAccount = chartAccountId
    ? accounts.find((a) => a.id === chartAccountId) ?? null
    : activeAccounts[0] ?? null;
  const history = chartAccount ? buildBalanceHistory(chartAccount, transactions, 30) : [];
  const maxBal = Math.max(...history.map((h) => h.balance), 1);
  const minBal = Math.min(...history.map((h) => h.balance), 0);
  const range = maxBal - minBal || 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas Bancárias"
        description="Gerencie todas as contas da empresa."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTransferOpen(true)} disabled={activeAccounts.length < 2}>
              <ArrowRightLeft className="h-4 w-4 mr-1" />Transferir
            </Button>
            <Dialog open={openForm} onOpenChange={(v) => { setOpenForm(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Nova Conta</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>{editing ? "Editar Conta" : "Nova Conta"}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Nome</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Conta Principal" />
                  </div>
                  <div className="space-y-1">
                    <Label>Banco</Label>
                    <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="Itaú, Bradesco..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Agência</Label>
                      <Input value={form.agency} onChange={(e) => setForm({ ...form, agency: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Conta</Label>
                      <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Saldo inicial (R$)</Label>
                      <Input value={form.initial_balance} onChange={(e) => setForm({ ...form, initial_balance: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Saldo mínimo (R$)</Label>
                      <Input value={form.minimum_balance} onChange={(e) => setForm({ ...form, minimum_balance: e.target.value })} placeholder="opcional" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Cor</Label>
                    <div className="flex gap-2">
                      {COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm({ ...form, color: c })}
                          className="h-7 w-7 rounded-full border-2 transition-transform"
                          style={{
                            backgroundColor: c,
                            borderColor: form.color === c ? "#000" : "transparent",
                            transform: form.color === c ? "scale(1.15)" : "scale(1)",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                    Conta ativa
                  </label>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpenForm(false)}>Cancelar</Button>
                  <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>
                    {save.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {/* Saldo consolidado */}
      <Card>
        <CardHeader><CardTitle className="text-sm text-muted-foreground">Saldo consolidado</CardTitle></CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold font-mono ${totalBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatBRL(totalBalance)}
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {accountsWithBalance.filter((a) => a.is_active !== false).map((a) => (
              <div key={a.id} className="rounded-md border p-2 text-xs">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: a.color ?? "#64748b" }} />
                  <span className="font-medium truncate">{a.name}</span>
                </div>
                <div className={`font-mono ${a._balance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {formatBRL(a._balance)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista de contas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accountsWithBalance.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma conta cadastrada. Clique em "Nova Conta" para começar.
            </CardContent>
          </Card>
        )}
        {accountsWithBalance.map((a) => {
          const below = a.minimum_balance != null && a._balance < Number(a.minimum_balance);
          return (
            <Card
              key={a.id}
              className="relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setChartAccountId(a.id)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: a.color ?? "#64748b" }} />
              <CardContent className="pl-5 pt-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.bank_name ?? "—"}</div>
                  </div>
                  {a.is_active === false && <Badge variant="secondary" className="text-[10px]">Arquivada</Badge>}
                </div>
                <div className={`text-2xl font-bold font-mono ${a._balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                  {formatBRL(a._balance)}
                </div>
                <div className="text-xs text-muted-foreground flex gap-3">
                  {a.agency && <span>Ag {a.agency}</span>}
                  <span>{maskAccountNumber(a.account_number)}</span>
                </div>
                {below && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" /> Abaixo do mínimo
                  </Badge>
                )}
                <div className="flex gap-1 pt-1" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openEdit(a)}>
                    <Pencil className="h-3 w-3 mr-1" />Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2"
                    onClick={() => archive.mutate(a)}>
                    <Archive className="h-3 w-3 mr-1" />{a.is_active === false ? "Reativar" : "Arquivar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Histórico de saldo */}
      {chartAccount && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Histórico de saldo — {chartAccount.name}</span>
              <select className="text-xs border rounded px-2 py-1"
                value={chartAccount.id}
                onChange={(e) => setChartAccountId(e.target.value)}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <svg viewBox="0 0 600 150" className="w-full h-32">
              <polyline
                fill="none"
                stroke={chartAccount.color ?? "#3b82f6"}
                strokeWidth="2"
                points={history
                  .map((h, i) => {
                    const x = (i / (history.length - 1)) * 600;
                    const y = 140 - ((h.balance - minBal) / range) * 130;
                    return `${x},${y}`;
                  })
                  .join(" ")}
              />
              <line x1="0" y1="140" x2="600" y2="140" stroke="#e5e7eb" strokeWidth="1" />
            </svg>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>{history[0]?.date.slice(5)}</span>
              <span>{history[history.length - 1]?.date.slice(5)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {companyId && (
        <TransferModal
          open={transferOpen}
          onOpenChange={setTransferOpen}
          accounts={activeAccounts}
          companyId={companyId}
        />
      )}
    </div>
  );
}
