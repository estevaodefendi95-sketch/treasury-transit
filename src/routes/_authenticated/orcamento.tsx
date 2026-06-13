import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { Save, Copy, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  categoriesQuery,
  transactionsQuery,
  formatBRL,
  type Category,
  type Transaction,
} from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/orcamento")({
  ssr: false,
  head: () => ({ meta: [{ title: "Orçamento Anual" }] }),
  component: OrcamentoPage,
});

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

type BudgetRow = {
  id?: string;
  company_id: string;
  category_id: string;
  year: number;
  month: number;
  amount: number;
};

type View = "orcado" | "realizado" | "comparativo";

function OrcamentoPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [view, setView] = useState<View>("orcado");

  const { data: categories = [] } = useQuery(categoriesQuery(companyId));
  const { data: transactions = [] } = useQuery(transactionsQuery(companyId));

  const expenseCategories = useMemo(
    () =>
      categories
        .filter((c) => c.type === "despesa" && c.is_active !== false)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories],
  );

  const budgetsQuery = useQuery({
    queryKey: ["annual_budgets", companyId, year],
    queryFn: async () => {
      if (!companyId) return [] as BudgetRow[];
      const { data, error } = await supabase
        .from("annual_budgets")
        .select("*")
        .eq("company_id", companyId)
        .eq("year", year);
      if (error) throw error;
      return (data ?? []) as BudgetRow[];
    },
    enabled: !!companyId,
  });

  // Local edit state: { [`${catId}_${month}`]: amount }
  const [edits, setEdits] = useState<Record<string, number>>({});
  useEffect(() => {
    const init: Record<string, number> = {};
    for (const b of budgetsQuery.data ?? []) {
      init[`${b.category_id}_${b.month}`] = Number(b.amount);
    }
    setEdits(init);
  }, [budgetsQuery.data]);

  const getBudget = (catId: string, m: number) =>
    edits[`${catId}_${m}`] ?? 0;

  const setBudget = (catId: string, m: number, v: number) =>
    setEdits((e) => ({ ...e, [`${catId}_${m}`]: v }));

  // Realizado (despesas pagas) por categoria por mês
  const realizado = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type !== "despesa") continue;
      if (t.status !== "pago") continue;
      const ref = t.payment_date ?? t.due_date;
      if (!ref) continue;
      const [yStr, mStr] = ref.split("-");
      if (Number(yStr) !== year) continue;
      const key = `${t.category_id ?? "_"}_${Number(mStr)}`;
      map[key] = (map[key] ?? 0) + Number(t.amount);
    }
    return map;
  }, [transactions, year]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      const rows: BudgetRow[] = [];
      for (const cat of expenseCategories) {
        for (let m = 1; m <= 12; m++) {
          const amt = edits[`${cat.id}_${m}`];
          if (amt && amt > 0) {
            rows.push({
              company_id: companyId,
              category_id: cat.id,
              year,
              month: m,
              amount: amt,
            });
          }
        }
      }
      // upsert on unique (company_id, category_id, year, month)
      if (rows.length === 0) return;
      const { error } = await supabase
        .from("annual_budgets")
        .upsert(rows, { onConflict: "company_id,category_id,year,month" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Orçamento salvo");
      qc.invalidateQueries({ queryKey: ["annual_budgets", companyId, year] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyPreviousYearMut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      const { data, error } = await supabase
        .from("annual_budgets")
        .select("*")
        .eq("company_id", companyId)
        .eq("year", year - 1);
      if (error) throw error;
      const next: Record<string, number> = { ...edits };
      for (const b of (data ?? []) as BudgetRow[]) {
        next[`${b.category_id}_${b.month}`] = Number(b.amount);
      }
      setEdits(next);
    },
    onSuccess: () => toast.success(`Valores de ${year - 1} carregados (clique em Salvar)`),
    onError: (e: Error) => toast.error(e.message),
  });

  const replicateJanuary = (catId: string) => {
    const jan = edits[`${catId}_1`] ?? 0;
    if (!jan) {
      toast.info("Preencha janeiro primeiro");
      return;
    }
    const next = { ...edits };
    for (let m = 2; m <= 12; m++) next[`${catId}_${m}`] = jan;
    setEdits(next);
  };

  // Variance color
  const varianceColor = (realized: number, budget: number) => {
    if (budget === 0) return "text-muted-foreground";
    const pct = realized / budget;
    if (pct > 1) return "text-rose-600";
    if (pct > 0.8) return "text-amber-600";
    return "text-emerald-600";
  };

  // Auto-create notifications when orçamento estourado (run once when comparativo + new month exceeded)
  useEffect(() => {
    if (view !== "comparativo" || !companyId) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      for (const cat of expenseCategories) {
        for (let m = 1; m <= 12; m++) {
          const budget = getBudget(cat.id, m);
          const real = realizado[`${cat.id}_${m}`] ?? 0;
          if (budget > 0 && real > budget) {
            const title = `Orçamento estourado: ${cat.name} (${MONTHS[m - 1]}/${year})`;
            const { data: existing } = await supabase
              .from("notifications")
              .select("id")
              .eq("company_id", companyId)
              .eq("type", "orcamento_estourado")
              .ilike("title", title)
              .gte("created_at", today)
              .limit(1);
            if (existing && existing.length > 0) continue;
            await supabase.from("notifications").insert({
              company_id: companyId,
              type: "orcamento_estourado",
              title,
              message: `Realizado ${formatBRL(real)} de ${formatBRL(budget)} (${Math.round((real / budget) * 100)}%)`,
              is_read: false,
            });
          }
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, year, companyId, expenseCategories.length]);

  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orçamento Anual"
        description="Planeje seu orçamento por categoria e acompanhe o realizado."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyPreviousYearMut.mutate()}
            disabled={copyPreviousYearMut.isPending}
          >
            <Copy className="h-3.5 w-3.5 mr-1" />
            Copiar de {year - 1}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="orcado">Orçado</TabsTrigger>
              <TabsTrigger value="realizado">Realizado</TabsTrigger>
              <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || view === "realizado"}
            size="sm"
          >
            {saveMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5 mr-1" />
            )}
            Salvar orçamento
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {view === "orcado" && "Orçamento por categoria"}
            {view === "realizado" && "Realizado por categoria"}
            {view === "comparativo" && "Orçado × Realizado"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {expenseCategories.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground text-center">
              Nenhuma categoria de despesa cadastrada. Cadastre em Financeiro → Categorias.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-2 sticky left-0 bg-muted/50 z-10 min-w-[180px]">
                    Categoria
                  </th>
                  {MONTHS.map((m) => (
                    <th key={m} className="p-2 text-right min-w-[90px]">
                      {m}
                    </th>
                  ))}
                  <th className="p-2 text-right min-w-[110px] bg-muted">Total</th>
                  <th className="p-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {expenseCategories.map((cat) => (
                  <CategoryRow
                    key={cat.id}
                    cat={cat}
                    view={view}
                    getBudget={getBudget}
                    setBudget={setBudget}
                    realizado={realizado}
                    varianceColor={varianceColor}
                    onReplicate={() => replicateJanuary(cat.id)}
                  />
                ))}
              </tbody>
              <tfoot className="bg-muted/30 font-medium">
                <tr>
                  <td className="p-2 sticky left-0 bg-muted/30">Total</td>
                  {MONTHS.map((_, i) => {
                    const m = i + 1;
                    const orc = expenseCategories.reduce(
                      (s, c) => s + getBudget(c.id, m),
                      0,
                    );
                    const real = expenseCategories.reduce(
                      (s, c) => s + (realizado[`${c.id}_${m}`] ?? 0),
                      0,
                    );
                    return (
                      <td key={m} className="p-2 text-right">
                        {view === "realizado"
                          ? formatBRL(real)
                          : view === "comparativo"
                            ? `${formatBRL(real)} / ${formatBRL(orc)}`
                            : formatBRL(orc)}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right bg-muted">
                    {(() => {
                      const orc = expenseCategories.reduce((s, c) => {
                        let t = 0;
                        for (let m = 1; m <= 12; m++) t += getBudget(c.id, m);
                        return s + t;
                      }, 0);
                      const real = Object.entries(realizado).reduce(
                        (s, [k, v]) => {
                          const [, mm] = k.split("_");
                          return mm ? s + v : s;
                        },
                        0,
                      );
                      if (view === "realizado") return formatBRL(real);
                      if (view === "comparativo")
                        return `${formatBRL(real)} / ${formatBRL(orc)}`;
                      return formatBRL(orc);
                    })()}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryRow({
  cat,
  view,
  getBudget,
  setBudget,
  realizado,
  varianceColor,
  onReplicate,
}: {
  cat: Category;
  view: View;
  getBudget: (catId: string, m: number) => number;
  setBudget: (catId: string, m: number, v: number) => void;
  realizado: Record<string, number>;
  varianceColor: (real: number, budget: number) => string;
  onReplicate: () => void;
}) {
  let rowTotalOrc = 0;
  let rowTotalReal = 0;
  for (let m = 1; m <= 12; m++) {
    rowTotalOrc += getBudget(cat.id, m);
    rowTotalReal += realizado[`${cat.id}_${m}`] ?? 0;
  }
  return (
    <tr className="border-t hover:bg-muted/20">
      <td className="p-2 sticky left-0 bg-background z-10 font-medium">
        <div className="flex items-center gap-1.5">
          {cat.icon && <span>{cat.icon}</span>}
          <span className="truncate max-w-[160px]">{cat.name}</span>
        </div>
      </td>
      {MONTHS.map((_, i) => {
        const m = i + 1;
        const budget = getBudget(cat.id, m);
        const real = realizado[`${cat.id}_${m}`] ?? 0;
        const exceeded = budget > 0 && real > budget;
        if (view === "orcado") {
          return (
            <td key={m} className="p-1">
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                className="h-8 text-right text-xs"
                value={budget || ""}
                onChange={(e) => setBudget(cat.id, m, Number(e.target.value) || 0)}
              />
            </td>
          );
        }
        if (view === "realizado") {
          return (
            <td key={m} className="p-2 text-right tabular-nums">
              {real ? formatBRL(real) : "—"}
            </td>
          );
        }
        // comparativo
        return (
          <td key={m} className="p-2 text-right tabular-nums">
            <div className={`flex items-center justify-end gap-1 ${varianceColor(real, budget)}`}>
              {exceeded && <AlertTriangle className="h-3 w-3" />}
              <div className="flex flex-col leading-tight">
                <span className="font-medium">{real ? formatBRL(real) : "—"}</span>
                <span className="text-[10px] text-muted-foreground">
                  / {budget ? formatBRL(budget) : "—"}
                </span>
              </div>
            </div>
          </td>
        );
      })}
      <td className="p-2 text-right bg-muted/30 font-semibold tabular-nums">
        {view === "realizado"
          ? formatBRL(rowTotalReal)
          : view === "comparativo"
            ? `${formatBRL(rowTotalReal)} / ${formatBRL(rowTotalOrc)}`
            : formatBRL(rowTotalOrc)}
      </td>
      <td className="p-1 text-center">
        {view === "orcado" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px]"
            onClick={onReplicate}
            title="Replicar janeiro para todos os meses"
          >
            ⇒
          </Button>
        )}
      </td>
    </tr>
  );
}
