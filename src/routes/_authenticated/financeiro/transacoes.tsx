import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Pencil, Sparkles, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  transactionsQuery, categoriesQuery, nameRulesQuery,
  insertRow, updateRow,
  formatBRL, formatDateBR, statusLabel, todayISO,
  type Transaction,
} from "@/lib/db";
import { categorizeTransaction, learnNameRule } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/financeiro/transacoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Transações — SuaEmpresa Gestão" }] }),
  component: TransacoesPage,
});

function TransacoesPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: transacoes = [] } = useQuery(transactionsQuery(companyId));
  const { data: categorias = [] } = useQuery(categoriesQuery(companyId));
  const { data: nameRules = [] } = useQuery(nameRulesQuery(companyId));
  const categorize = useServerFn(categorizeTransaction);
  const learnName = useServerFn(learnNameRule);

  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "expense" as "income" | "expense",
    description: "", amount: "", due_date: todayISO(),
    category_id: "" as string | null,
  });
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<{ category_id: string | null; category_name: string | null; confidence: number; reason: string } | null>(null);
  const [autoApplied, setAutoApplied] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const filtered = transacoes.filter((t) =>
    t.description.toLowerCase().includes(filter.toLowerCase()),
  );

  // Sugestão IA quando descrição + valor mudam (debounce)
  useEffect(() => {
    setSuggestion(null);
    setAutoApplied(false);
    if (!open) return;
    if (form.description.trim().length < 3 || !form.amount) return;
    const handle = setTimeout(async () => {
      setSuggesting(true);
      try {
        const eligible = categorias
          .filter((c) => !c.type || c.type === form.type)
          .map((c) => ({ id: c.id, name: c.name, type: c.type ?? "" }));
        if (eligible.length === 0) return;
        const res = await categorize({
          data: {
            description: form.description,
            amount: Number(form.amount.replace(",", ".")),
            type: form.type,
            categories: eligible,
          },
        });
        setSuggestion(res);
        if (res.confidence >= 0.8 && res.category_id) {
          setForm((f) => ({ ...f, category_id: res.category_id }));
          setAutoApplied(true);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSuggesting(false);
      }
    }, 700);
    return () => clearTimeout(handle);
  }, [form.description, form.amount, form.type, open, categorias, categorize]);

  const acceptSuggestion = () => {
    if (suggestion?.category_id) {
      setForm((f) => ({ ...f, category_id: suggestion.category_id }));
      toast.success("Categoria aplicada");
    }
  };

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
        category_id: form.category_id || null,
        category_auto_applied: autoApplied,
      } as unknown as Transaction);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      toast.success("Transação criada");
      setOpen(false);
      setForm({ type: "expense", description: "", amount: "", due_date: todayISO(), category_id: "" });
      setSuggestion(null);
      setAutoApplied(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditDraft(t.edited_description ?? t.description);
  };

  const saveEdit = useMutation({
    mutationFn: async (t: Transaction) => {
      const original = t.original_description ?? t.description;
      await updateRow<Transaction>("transactions", t.id, {
        description: editDraft,
        edited_description: editDraft,
        original_description: original,
      });
      // Aprende regra se houve renomeação significativa
      if (original.toLowerCase() !== editDraft.toLowerCase() && original.length > 3) {
        try {
          const rule = await learnName({ data: { original, new_name: editDraft } });
          if (rule.confidence >= 0.5 && companyId) {
            // checa se já existe regra parecida
            const exists = nameRules.find((r) => r.original_pattern.toLowerCase() === rule.pattern.toLowerCase());
            if (!exists) {
              await supabase.from("name_rules").insert({
                company_id: companyId,
                original_pattern: rule.pattern,
                suggested_name: rule.suggested_name,
                times_applied: 0,
              });
              qc.invalidateQueries({ queryKey: ["name_rules", companyId] });
              toast.success("Regra de nome aprendida");
            }
          }
        } catch (e) {
          console.error("learnName failed", e);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const catById = (id: string | null) => categorias.find((c) => c.id === id);

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
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as "income" | "expense", category_id: "" })}>
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
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
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={form.category_id ?? ""}
                    onChange={(e) => { setForm({ ...form, category_id: e.target.value }); setAutoApplied(false); }}>
                    <option value="">— Selecione —</option>
                    {categorias
                      .filter((c) => !c.type || c.type === form.type)
                      .map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                  </select>
                  {suggesting && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Analisando com IA...
                    </div>
                  )}
                  {suggestion && suggestion.category_id && !suggesting && (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-primary/5 border border-primary/20 p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        {autoApplied ? (
                          <span><b>Auto categorizado:</b> {suggestion.category_name} ({Math.round(suggestion.confidence * 100)}%)</span>
                        ) : (
                          <span>💡 Sugerido: <b>{suggestion.category_name}</b> ({Math.round(suggestion.confidence * 100)}%)</span>
                        )}
                      </div>
                      {!autoApplied && form.category_id !== suggestion.category_id && (
                        <Button size="sm" variant="ghost" className="h-6" onClick={acceptSuggestion}>Aceitar</Button>
                      )}
                    </div>
                  )}
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
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Nenhuma transação</TableCell></TableRow>
              )}
              {filtered.map((t) => {
                const cat = catById(t.category_id);
                const isEditing = editingId === t.id;
                return (
                  <TableRow key={t.id} className="group">
                    <TableCell>{formatDateBR(t.payment_date ?? t.due_date)}</TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex gap-1 items-center">
                          <Input className="h-7" value={editDraft} onChange={(e) => setEditDraft(e.target.value)} />
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => saveEdit.mutate(t)} disabled={saveEdit.isPending}>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium flex items-center gap-1">
                            {t.description}
                            <button onClick={() => startEdit(t)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </button>
                          </div>
                          {t.original_description && t.original_description !== t.description && (
                            <div className="text-[10px] text-muted-foreground italic">{t.original_description}</div>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {cat ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <span>{cat.icon}</span>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color ?? "#64748b" }} />
                          <span>{cat.name}</span>
                          {t.category_auto_applied && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-primary/5">IA</Badge>
                          )}
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
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
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
