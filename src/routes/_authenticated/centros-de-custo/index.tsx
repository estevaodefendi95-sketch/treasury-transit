import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  costCentersQuery,
  transactionsQuery,
  insertRow,
  updateRow,
  deleteRow,
  formatBRL,
  todayISO,
  type CostCenter,
} from "@/lib/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/centros-de-custo/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Centros de Custo — SuaEmpresa Gestão" }] }),
  component: CentrosCustoPage,
});

const COLOR_OPTIONS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#64748b"];

function CentrosCustoPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: centers = [] } = useQuery(costCentersQuery(companyId));
  const { data: transactions = [] } = useQuery(transactionsQuery(companyId));

  const monthStart = todayISO().slice(0, 7) + "-01";
  const spentByCenter = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of transactions) {
      if (!t.cost_center_id) continue;
      if (t.type !== "despesa") continue;
      if ((t.payment_date ?? t.due_date) < monthStart) continue;
      m[t.cost_center_id] = (m[t.cost_center_id] ?? 0) + Number(t.amount);
    }
    return m;
  }, [transactions, monthStart]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    monthly_budget: "",
    color: COLOR_OPTIONS[0],
    is_active: true,
  });

  const resetForm = () => {
    setForm({ name: "", code: "", description: "", monthly_budget: "", color: COLOR_OPTIONS[0], is_active: true });
    setEditing(null);
  };

  const openEdit = (c: CostCenter) => {
    setEditing(c);
    setForm({
      name: c.name,
      code: c.code ?? "",
      description: c.description ?? "",
      monthly_budget: c.monthly_budget?.toString() ?? "",
      color: c.color ?? COLOR_OPTIONS[0],
      is_active: c.is_active ?? true,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      const payload = {
        company_id: companyId,
        name: form.name.trim(),
        code: form.code.trim() || null,
        description: form.description.trim() || null,
        monthly_budget: form.monthly_budget ? Number(form.monthly_budget.replace(",", ".")) : null,
        color: form.color,
        is_active: form.is_active,
      };
      if (editing) {
        await updateRow("cost_centers", editing.id, payload);
      } else {
        await insertRow("cost_centers", payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cost_centers", companyId] });
      toast.success(editing ? "Centro de custo atualizado" : "Centro de custo criado");
      setOpen(false);
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (c: CostCenter) =>
      updateRow("cost_centers", c.id, { is_active: !c.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cost_centers", companyId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteRow("cost_centers", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cost_centers", companyId] });
      toast.success("Centro de custo removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Centros de Custo"
        description="Organize despesas por departamento, projeto ou unidade."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/centros-de-custo/relatorio">
                <BarChart3 className="h-4 w-4 mr-1" /> Relatório
              </Link>
            </Button>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" /> Novo</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editing ? "Editar" : "Novo"} centro de custo</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Nome*</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Código</Label>
                      <Input placeholder="ex: SP01" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Orçamento mensal</Label>
                      <Input placeholder="0,00" value={form.monthly_budget} onChange={(e) => setForm({ ...form, monthly_budget: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Descrição</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Cor</Label>
                    <div className="flex gap-2">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm({ ...form, color: c })}
                          className={cn("h-7 w-7 rounded-full border-2", form.color === c ? "border-foreground" : "border-transparent")}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <Label>Ativo</Label>
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  </div>
                  <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full">
                    {save.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {centers.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          Nenhum centro de custo cadastrado.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {centers.map((c) => {
            const spent = spentByCenter[c.id] ?? 0;
            const budget = c.monthly_budget ?? 0;
            const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
            const barColor =
              pct >= 100 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
            return (
              <Card key={c.id} style={{ borderLeft: `4px solid ${c.color ?? "#64748b"}` }} className={cn(!c.is_active && "opacity-60")}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {c.name}
                        {c.code && <Badge variant="outline" className="text-[10px]">{c.code}</Badge>}
                      </CardTitle>
                      {c.description && (
                        <div className="text-xs text-muted-foreground mt-1">{c.description}</div>
                      )}
                    </div>
                    <Switch checked={c.is_active ?? false} onCheckedChange={() => toggle.mutate(c)} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {budget > 0 ? (
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Mês atual</span>
                        <span className="font-mono">{formatBRL(spent)} / {formatBRL(budget)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full transition-all", barColor)} style={{ width: `${pct}%` }} />
                      </div>
                      <div className={cn("text-[10px] mt-1 text-right",
                        pct >= 100 ? "text-rose-600" : pct >= 70 ? "text-amber-700" : "text-muted-foreground"
                      )}>
                        {pct.toFixed(0)}% utilizado
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Gasto: {formatBRL(spent)} (sem orçamento)</div>
                  )}
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => confirm(`Remover "${c.name}"?`) && remove.mutate(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
