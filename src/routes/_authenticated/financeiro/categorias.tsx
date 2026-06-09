import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  categoriesQuery, transactionsQuery, insertRow, updateRow, deleteRow,
  formatBRL, type Category,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/financeiro/categorias")({
  ssr: false,
  head: () => ({ meta: [{ title: "Categorias — SuaEmpresa Gestão" }] }),
  component: CategoriasPage,
});

const COLORS = ["#ef4444","#f97316","#eab308","#84cc16","#10b981","#14b8a6","#06b6d4","#3b82f6","#8b5cf6","#a855f7","#ec4899","#64748b"];
const ICONS = ["📦","💼","🏢","💡","🌐","📣","🧾","🔧","🍽️","🚗","🛒","🛠️","📈","💰","💳","📊","🏦","🎯"];

function CategoriasPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: categorias = [] } = useQuery(categoriesQuery(companyId));
  const { data: transacoes = [] } = useQuery(transactionsQuery(companyId));

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({
    name: "", type: "expense" as "income" | "expense",
    color: COLORS[0], icon: ICONS[0], parent_id: "", monthly_budget: "",
  });

  // Gasto do mês corrente por categoria
  const monthlySpent = useMemo(() => {
    const now = new Date();
    const ym = now.toISOString().slice(0, 7);
    const map = new Map<string, number>();
    transacoes.forEach((t) => {
      if (!t.category_id || !t.due_date?.startsWith(ym)) return;
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + Number(t.amount));
    });
    return map;
  }, [transacoes]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", type: "expense", color: COLORS[0], icon: ICONS[0], parent_id: "", monthly_budget: "" });
    setOpen(true);
  };

  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({
      name: c.name,
      type: ((c.type as "income" | "expense") ?? "expense"),
      color: c.color ?? COLORS[0],
      icon: c.icon ?? ICONS[0],
      parent_id: "",
      monthly_budget: "",
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      const payload = {
        company_id: companyId,
        name: form.name,
        type: form.type,
        color: form.color,
        icon: form.icon,
        parent_id: form.parent_id || null,
        monthly_budget: form.monthly_budget ? Number(form.monthly_budget.replace(",", ".")) : null,
        is_active: true,
      };
      if (editing) return updateRow<Category>("categories", editing.id, payload);
      return insertRow<Category>("categories", payload as unknown as Category);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories", companyId] });
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteRow("categories", id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories", companyId] });
      toast.success("Categoria removida");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const groups = [
    { type: "expense" as const, title: "Despesas" },
    { type: "income" as const, title: "Receitas" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorias"
        description="Organize receitas e despesas com orçamento mensal."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Nova</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense" })}
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <div className="flex flex-wrap gap-1">
                      {COLORS.map((c) => (
                        <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                          className={`h-7 w-7 rounded-md border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ícone</Label>
                    <div className="flex flex-wrap gap-1">
                      {ICONS.map((i) => (
                        <button key={i} type="button" onClick={() => setForm({ ...form, icon: i })}
                          className={`h-7 w-7 rounded-md border text-lg ${form.icon === i ? "border-foreground" : "border-transparent"}`}>
                          {i}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Categoria pai (opcional)</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.parent_id}
                    onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                  >
                    <option value="">— Nenhuma —</option>
                    {categorias
                      .filter((c) => c.type === form.type && c.id !== editing?.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Orçamento mensal (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={form.monthly_budget}
                    onChange={(e) => setForm({ ...form, monthly_budget: e.target.value })}
                  />
                </div>
                <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name} className="w-full">
                  {save.isPending ? "Salvando..." : (editing ? "Salvar" : "Criar")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {groups.map((g) => {
        const items = categorias.filter((c) => (c.type ?? "expense") === g.type);
        return (
          <Card key={g.type}>
            <CardHeader><CardTitle className="text-base">{g.title} ({items.length})</CardTitle></CardHeader>
            <CardContent>
              {items.length === 0 && (
                <EmptyState icon="🏷️" title="Nenhuma categoria" description="Organize seus lançamentos por categoria" />
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((c) => {
                  const spent = monthlySpent.get(c.id) ?? 0;
                  const budget = Number(c.monthly_budget ?? 0);
                  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
                  const over = budget > 0 && spent >= budget;
                  return (
                    <div key={c.id} className="rounded-lg border border-border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl">{c.icon ?? "🏷️"}</span>
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color ?? "#64748b" }} />
                          <div className="font-medium truncate">{c.name}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove.mutate(c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {budget > 0 ? (
                        <>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatBRL(spent)} / {formatBRL(budget)}</span>
                            {over && <Badge variant="destructive" className="text-[10px]">100%+</Badge>}
                          </div>
                          <Progress value={pct} className={over ? "[&>div]:bg-rose-600" : ""} />
                        </>
                      ) : (
                        <div className="text-xs text-muted-foreground">Gasto: {formatBRL(spent)} (sem orçamento)</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
