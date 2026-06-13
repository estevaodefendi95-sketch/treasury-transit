import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { todayISO, type BankAccount } from "@/lib/db";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  accounts: BankAccount[];
  companyId: string;
}

export function TransferModal({ open, onOpenChange, accounts, companyId }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    from: "",
    to: "",
    amount: "",
    date: todayISO(),
    description: "Transferência entre contas",
  });
  const [saving, setSaving] = useState(false);

  const reset = () => setForm({ from: "", to: "", amount: "", date: todayISO(), description: "Transferência entre contas" });

  const submit = async () => {
    if (!form.from || !form.to || !form.amount) {
      toast.error("Preencha conta origem, destino e valor");
      return;
    }
    if (form.from === form.to) {
      toast.error("Contas origem e destino devem ser diferentes");
      return;
    }
    const amount = Number(form.amount.replace(",", "."));
    if (!amount || amount <= 0) {
      toast.error("Valor inválido");
      return;
    }
    setSaving(true);
    try {
      const groupId = crypto.randomUUID();
      const fromName = accounts.find((a) => a.id === form.from)?.name ?? "";
      const toName = accounts.find((a) => a.id === form.to)?.name ?? "";
      const rows = [
        {
          company_id: companyId,
          type: "despesa",
          status: "pago",
          description: `${form.description} → ${toName}`,
          amount,
          due_date: form.date,
          payment_date: form.date,
          bank_account_id: form.from,
          recurrence_group_id: groupId,
        },
        {
          company_id: companyId,
          type: "receita",
          status: "recebido",
          description: `${form.description} ← ${fromName}`,
          amount,
          due_date: form.date,
          payment_date: form.date,
          bank_account_id: form.to,
          recurrence_group_id: groupId,
        },
      ];
      const { error } = await supabase.from("transactions").insert(rows);
      if (error) throw error;
      toast.success("Transferência registrada");
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" /> Nova Transferência
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>De</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })}>
                <option value="">—</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Para</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })}>
                <option value="">—</option>
                {accounts.filter((a) => a.id !== form.from).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor (R$)</Label>
              <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
