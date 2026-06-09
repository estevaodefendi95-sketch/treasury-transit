import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, Mail, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  transactionsQuery,
  categoriesQuery,
  costCentersQuery,
  customersQuery,
  bankAccountsQuery,
  formatBRL,
  formatDateBR,
  todayISO,
  type Transaction,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/relatorios")({
  ssr: false,
  head: () => ({ meta: [{ title: "Relatórios Financeiros" }] }),
  component: RelatoriosPage,
});

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, "'")}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios Financeiros"
        description="DRE, fluxo de caixa, inadimplência, categorias e centros de custo."
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir
          </Button>
        }
      />

      <Tabs defaultValue="dre">
        <TabsList>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="inadimplencia">Inadimplência</TabsTrigger>
          <TabsTrigger value="categoria">Por Categoria</TabsTrigger>
          <TabsTrigger value="centro">Centro de Custo</TabsTrigger>
        </TabsList>
        <TabsContent value="dre"><DRETab /></TabsContent>
        <TabsContent value="fluxo"><FluxoTab /></TabsContent>
        <TabsContent value="inadimplencia"><InadimplenciaTab /></TabsContent>
        <TabsContent value="categoria"><CategoriaTab /></TabsContent>
        <TabsContent value="centro"><CentroTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// Tab 1 — DRE
// ============================================================================
function DRETab() {
  const { companyId } = useCurrentCompany();
  const { data: transactions = [], isLoading } = useQuery(transactionsQuery(companyId));
  const { data: categories = [] } = useQuery(categoriesQuery(companyId));
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [annual, setAnnual] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const periodKey = (d: string) => (annual ? d.slice(0, 4) : d.slice(0, 7));
  const current = annual ? String(year) : `${year}-${String(month).padStart(2, "0")}`;
  const prevDate = new Date(year, month - 1 - 1, 1);
  const previous = annual ? String(year - 1) : `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  const inPeriod = (t: Transaction, key: string) => {
    const d = t.payment_date ?? t.due_date;
    return periodKey(d) === key;
  };

  const aggregate = (key: string) => {
    const byCat: Record<string, { receita: number; despesa: number; transactions: Transaction[] }> = {};
    let totReceita = 0;
    let totDespesa = 0;
    for (const t of transactions) {
      if (!inPeriod(t, key)) continue;
      const k = t.category_id ?? "—";
      if (!byCat[k]) byCat[k] = { receita: 0, despesa: 0, transactions: [] };
      byCat[k].transactions.push(t);
      if (t.type === "income") {
        byCat[k].receita += Number(t.amount);
        totReceita += Number(t.amount);
      } else if (t.type === "expense") {
        byCat[k].despesa += Number(t.amount);
        totDespesa += Number(t.amount);
      }
    }
    return { byCat, totReceita, totDespesa };
  };

  const cur = aggregate(current);
  const prev = aggregate(previous);

  const variance = (a: number, b: number) => (b === 0 ? (a > 0 ? 100 : 0) : ((a - b) / b) * 100);

  const allCatIds = Array.from(new Set([...Object.keys(cur.byCat), ...Object.keys(prev.byCat)]));
  const incomeCats = allCatIds.filter((id) => {
    const c = categories.find((x) => x.id === id);
    return c?.type === "income" || (cur.byCat[id]?.receita ?? 0) > 0;
  });
  const expenseCats = allCatIds.filter((id) => {
    const c = categories.find((x) => x.id === id);
    return c?.type === "expense" || (cur.byCat[id]?.despesa ?? 0) > 0;
  });

  const toggleExpand = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ["DRE", current, `vs ${previous}`],
      ["", "Atual", "Anterior", "Variação %"],
      ["RECEITAS"],
    ];
    for (const id of incomeCats) {
      const c = categories.find((x) => x.id === id);
      rows.push([
        c?.name ?? "Sem categoria",
        (cur.byCat[id]?.receita ?? 0).toFixed(2),
        (prev.byCat[id]?.receita ?? 0).toFixed(2),
        variance(cur.byCat[id]?.receita ?? 0, prev.byCat[id]?.receita ?? 0).toFixed(1),
      ]);
    }
    rows.push(["Total Receitas", cur.totReceita.toFixed(2), prev.totReceita.toFixed(2)]);
    rows.push(["DESPESAS"]);
    for (const id of expenseCats) {
      const c = categories.find((x) => x.id === id);
      rows.push([
        c?.name ?? "Sem categoria",
        (cur.byCat[id]?.despesa ?? 0).toFixed(2),
        (prev.byCat[id]?.despesa ?? 0).toFixed(2),
        variance(cur.byCat[id]?.despesa ?? 0, prev.byCat[id]?.despesa ?? 0).toFixed(1),
      ]);
    }
    rows.push(["Total Despesas", cur.totDespesa.toFixed(2), prev.totDespesa.toFixed(2)]);
    rows.push(["RESULTADO", (cur.totReceita - cur.totDespesa).toFixed(2), (prev.totReceita - prev.totDespesa).toFixed(2)]);
    downloadCSV(`dre-${current}.csv`, rows);
  };

  if (isLoading) return <SkeletonBlock />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label>Ano</Label>
            <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-24" />
          </div>
          {!annual && (
            <div className="space-y-1">
              <Label>Mês</Label>
              <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString("pt-BR", { month: "long" })}</option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={annual} onChange={(e) => setAnnual(e.target.checked)} />
            Visão anual
          </label>
          <div className="ml-auto">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">DRE — {annual ? year : `${String(month).padStart(2, "0")}/${year}`}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead className="text-right">Atual</TableHead>
                <TableHead className="text-right">Anterior</TableHead>
                <TableHead className="text-right">Variação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-emerald-50 font-semibold">
                <TableCell colSpan={4}>(+) RECEITAS</TableCell>
              </TableRow>
              {incomeCats.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-3">Sem receitas no período</TableCell></TableRow>
              )}
              {incomeCats.map((id) => {
                const c = categories.find((x) => x.id === id);
                const a = cur.byCat[id]?.receita ?? 0;
                const b = prev.byCat[id]?.receita ?? 0;
                const v = variance(a, b);
                const isOpen = expanded.has(id);
                return (
                  <>
                    <TableRow key={id} className="cursor-pointer hover:bg-muted/30" onClick={() => toggleExpand(id)}>
                      <TableCell className="pl-6 flex items-center gap-1">
                        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {c?.icon} {c?.name ?? "Sem categoria"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-emerald-700">{formatBRL(a)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{formatBRL(b)}</TableCell>
                      <TableCell className={`text-right font-mono ${v >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {v >= 0 ? "+" : ""}{v.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                    {isOpen && (cur.byCat[id]?.transactions ?? []).map((t) => (
                      <TableRow key={t.id} className="bg-muted/20">
                        <TableCell className="pl-12 text-xs">
                          {formatDateBR(t.payment_date ?? t.due_date)} — {t.description}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatBRL(Number(t.amount))}</TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    ))}
                  </>
                );
              })}
              <TableRow className="font-semibold border-t-2">
                <TableCell>Total Receitas</TableCell>
                <TableCell className="text-right font-mono text-emerald-700">{formatBRL(cur.totReceita)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{formatBRL(prev.totReceita)}</TableCell>
                <TableCell></TableCell>
              </TableRow>

              <TableRow className="bg-rose-50 font-semibold">
                <TableCell colSpan={4}>(−) DESPESAS</TableCell>
              </TableRow>
              {expenseCats.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-3">Sem despesas no período</TableCell></TableRow>
              )}
              {expenseCats.map((id) => {
                const c = categories.find((x) => x.id === id);
                const a = cur.byCat[id]?.despesa ?? 0;
                const b = prev.byCat[id]?.despesa ?? 0;
                const v = variance(a, b);
                const isOpen = expanded.has(id + "_exp");
                return (
                  <>
                    <TableRow key={id + "_exp"} className="cursor-pointer hover:bg-muted/30" onClick={() => toggleExpand(id + "_exp")}>
                      <TableCell className="pl-6 flex items-center gap-1">
                        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        {c?.icon} {c?.name ?? "Sem categoria"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-rose-700">{formatBRL(a)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{formatBRL(b)}</TableCell>
                      <TableCell className={`text-right font-mono ${v <= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {v >= 0 ? "+" : ""}{v.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                    {isOpen && (cur.byCat[id]?.transactions ?? []).map((t) => (
                      <TableRow key={t.id} className="bg-muted/20">
                        <TableCell className="pl-12 text-xs">
                          {formatDateBR(t.payment_date ?? t.due_date)} — {t.description}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">{formatBRL(Number(t.amount))}</TableCell>
                        <TableCell colSpan={2}></TableCell>
                      </TableRow>
                    ))}
                  </>
                );
              })}
              <TableRow className="font-semibold border-t-2">
                <TableCell>Total Despesas</TableCell>
                <TableCell className="text-right font-mono text-rose-700">{formatBRL(cur.totDespesa)}</TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">{formatBRL(prev.totDespesa)}</TableCell>
                <TableCell></TableCell>
              </TableRow>

              <TableRow className="bg-primary/5 font-bold text-base border-t-4">
                <TableCell>(=) RESULTADO</TableCell>
                <TableCell className={`text-right font-mono ${cur.totReceita - cur.totDespesa >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {formatBRL(cur.totReceita - cur.totDespesa)}
                </TableCell>
                <TableCell className={`text-right font-mono ${prev.totReceita - prev.totDespesa >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {formatBRL(prev.totReceita - prev.totDespesa)}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Tab 2 — Fluxo de Caixa
// ============================================================================
function FluxoTab() {
  const { companyId } = useCurrentCompany();
  const { data: transactions = [], isLoading } = useQuery(transactionsQuery(companyId));
  const { data: accounts = [] } = useQuery(bankAccountsQuery(companyId));

  const today = todayISO();
  const monthStart = today.slice(0, 7) + "-01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [mode, setMode] = useState<"realizado" | "projetado" | "ambos">("ambos");

  const opening = accounts.reduce((s, a) => s + Number(a.initial_balance ?? 0), 0);

  const filtered = transactions.filter((t) => {
    const d = t.payment_date ?? t.due_date;
    if (d < from || d > to) return false;
    const realized = !!t.payment_date;
    if (mode === "realizado" && !realized) return false;
    if (mode === "projetado" && realized) return false;
    return true;
  });

  type Row = { date: string; entradas: number; saidas: number; saldo: number; acumulado: number };
  const rows: Row[] = useMemo(() => {
    const byDay: Record<string, { entradas: number; saidas: number }> = {};
    for (const t of filtered) {
      const d = (t.payment_date ?? t.due_date).slice(0, 10);
      if (!byDay[d]) byDay[d] = { entradas: 0, saidas: 0 };
      if (t.type === "income") byDay[d].entradas += Number(t.amount);
      else if (t.type === "expense") byDay[d].saidas += Number(t.amount);
    }
    let acc = opening;
    return Object.keys(byDay)
      .sort()
      .map((d) => {
        const saldo = byDay[d].entradas - byDay[d].saidas;
        acc += saldo;
        return { date: d, entradas: byDay[d].entradas, saidas: byDay[d].saidas, saldo, acumulado: acc };
      });
  }, [filtered, opening]);

  const exportCSV = () => {
    const data: (string | number)[][] = [["Data", "Entradas", "Saídas", "Saldo do Dia", "Saldo Acumulado"]];
    data.push(["Abertura", "", "", "", opening.toFixed(2)]);
    rows.forEach((r) => data.push([r.date, r.entradas.toFixed(2), r.saidas.toFixed(2), r.saldo.toFixed(2), r.acumulado.toFixed(2)]));
    downloadCSV(`fluxo-caixa-${from}-a-${to}.csv`, data);
  };

  if (isLoading) return <SkeletonBlock />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Modo</Label>
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="realizado">Realizado</option>
              <option value="projetado">Projetado</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>
          <div className="ml-auto">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Saldo acumulado</CardTitle></CardHeader>
        <CardContent className="h-64">
          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Area type="monotone" dataKey="acumulado" stroke="hsl(217, 91%, 60%)" fill="hsl(217, 91%, 60% / 0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Saldo do Dia</TableHead>
                <TableHead className="text-right">Saldo Acumulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40">
                <TableCell className="font-medium">Abertura</TableCell>
                <TableCell colSpan={3}></TableCell>
                <TableCell className="text-right font-mono">{formatBRL(opening)}</TableCell>
              </TableRow>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Sem movimentações no período</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.date} className={r.saldo >= 0 ? "bg-emerald-50/40" : "bg-rose-50/40"}>
                  <TableCell>{formatDateBR(r.date)}</TableCell>
                  <TableCell className="text-right font-mono text-emerald-700">{formatBRL(r.entradas)}</TableCell>
                  <TableCell className="text-right font-mono text-rose-700">{formatBRL(r.saidas)}</TableCell>
                  <TableCell className={`text-right font-mono ${r.saldo >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {formatBRL(r.saldo)}
                  </TableCell>
                  <TableCell className={`text-right font-mono font-semibold ${r.acumulado >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    {formatBRL(r.acumulado)}
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

// ============================================================================
// Tab 3 — Inadimplência
// ============================================================================
function InadimplenciaTab() {
  const { companyId } = useCurrentCompany();
  const { data: transactions = [], isLoading } = useQuery(transactionsQuery(companyId));
  const { data: customers = [] } = useQuery(customersQuery(companyId));

  const today = todayISO();
  const daysBetween = (a: string, b: string) =>
    Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);

  const overdue = transactions.filter(
    (t) =>
      t.type === "income" &&
      !t.payment_date &&
      t.status !== "paid" &&
      t.status !== "received" &&
      t.status !== "canceled" &&
      t.due_date <= today,
  );

  const buckets = [
    { label: "Vence hoje", min: 0, max: 0, color: "bg-amber-50 text-amber-700" },
    { label: "1-7 dias", min: 1, max: 7, color: "bg-orange-50 text-orange-700" },
    { label: "8-30 dias", min: 8, max: 30, color: "bg-rose-50 text-rose-700" },
    { label: "31-60 dias", min: 31, max: 60, color: "bg-rose-100 text-rose-800" },
    { label: "+60 dias", min: 61, max: Infinity, color: "bg-rose-200 text-rose-900" },
  ];

  const inBucket = (t: Transaction, b: typeof buckets[number]) => {
    const d = daysBetween(today, t.due_date);
    return d >= b.min && d <= b.max;
  };

  const totalOverdue = overdue.reduce((s, t) => s + Number(t.amount), 0);

  const exportCSV = () => {
    const rows: (string | number)[][] = [["Cliente", "Descrição", "Vencimento", "Dias atraso", "Valor"]];
    overdue.forEach((t) => {
      const c = customers.find((x) => x.id === t.customer_id);
      rows.push([
        c?.name ?? "—",
        t.description,
        t.due_date,
        daysBetween(today, t.due_date),
        Number(t.amount).toFixed(2),
      ]);
    });
    downloadCSV("inadimplencia.csv", rows);
  };

  if (isLoading) return <SkeletonBlock />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Total em atraso</div>
            <div className="text-3xl font-bold text-rose-600 font-mono">{formatBRL(totalOverdue)}</div>
          </div>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-5">
        {buckets.map((b) => {
          const list = overdue.filter((t) => inBucket(t, b));
          const total = list.reduce((s, t) => s + Number(t.amount), 0);
          return (
            <Card key={b.label}>
              <CardContent className="pt-6">
                <Badge className={b.color}>{b.label}</Badge>
                <div className="text-xl font-bold mt-2">{list.length}</div>
                <div className="text-xs font-mono text-muted-foreground">{formatBRL(total)}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Lançamentos em atraso</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Dias</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overdue.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Sem inadimplência 🎉</TableCell></TableRow>
              )}
              {overdue.map((t) => {
                const c = customers.find((x) => x.id === t.customer_id);
                const days = daysBetween(today, t.due_date);
                return (
                  <TableRow key={t.id}>
                    <TableCell>{c?.name ?? "—"}</TableCell>
                    <TableCell>{t.description}</TableCell>
                    <TableCell>{formatDateBR(t.due_date)}</TableCell>
                    <TableCell className="text-right">{days}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(Number(t.amount))}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toast.success(`Cobrança simulada para ${c?.name ?? "cliente"}`)}
                      >
                        <Mail className="h-3.5 w-3.5 mr-1" /> Enviar cobrança
                      </Button>
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

// ============================================================================
// Tab 4 — Por Categoria
// ============================================================================
function CategoriaTab() {
  const { companyId } = useCurrentCompany();
  const { data: transactions = [], isLoading } = useQuery(transactionsQuery(companyId));
  const { data: categories = [] } = useQuery(categoriesQuery(companyId));

  const today = todayISO();
  const [period, setPeriod] = useState(today.slice(0, 7));

  const inPeriod = (t: Transaction) => (t.payment_date ?? t.due_date).slice(0, 7) === period;

  const rows = useMemo(() => {
    return categories
      .filter((c) => c.type === "expense" || !c.type)
      .map((c) => {
        const spent = transactions
          .filter((t) => t.category_id === c.id && t.type === "expense" && inPeriod(t))
          .reduce((s, t) => s + Number(t.amount), 0);
        const budget = Number(c.monthly_budget ?? 0);
        const remaining = budget - spent;
        const pct = budget > 0 ? (spent / budget) * 100 : 0;
        return { id: c.id, name: c.name, icon: c.icon, color: c.color, budget, spent, remaining, pct };
      })
      .sort((a, b) => b.spent - a.spent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, transactions, period]);

  const top10 = rows.slice(0, 10);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  const exportCSV = () => {
    const data: (string | number)[][] = [["Categoria", "Orçamento", "Gasto", "Restante", "%"]];
    rows.forEach((r) => data.push([r.name, r.budget.toFixed(2), r.spent.toFixed(2), r.remaining.toFixed(2), r.pct.toFixed(1)]));
    downloadCSV(`categorias-${period}.csv`, data);
  };

  if (isLoading) return <SkeletonBlock />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label>Mês</Label>
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="ml-auto">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Despesas por categoria</CardTitle></CardHeader>
          <CardContent className="h-72">
            {top10.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={top10.filter((r) => r.spent > 0)} dataKey="spent" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90}>
                    {top10.map((r, i) => <Cell key={i} fill={r.color ?? `hsl(${(i * 35) % 360}, 70%, 55%)`} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 — valor</CardTitle></CardHeader>
          <CardContent className="h-72">
            {top10.length === 0 ? <EmptyState /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={top10} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" fontSize={10} width={110} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="spent" fill="hsl(217, 91%, 60%)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Detalhamento — Total gasto: <span className="font-mono">{formatBRL(totalSpent)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Orçamento</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
                <TableHead className="text-right">Restante</TableHead>
                <TableHead>%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Sem dados</TableCell></TableRow>
              )}
              {rows.map((r) => {
                const tone = r.pct >= 100 ? "bg-rose-500" : r.pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.icon} {r.name}</TableCell>
                    <TableCell className="text-right font-mono">{r.budget > 0 ? formatBRL(r.budget) : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{formatBRL(r.spent)}</TableCell>
                    <TableCell className={`text-right font-mono ${r.remaining < 0 ? "text-rose-600" : ""}`}>
                      {r.budget > 0 ? formatBRL(r.remaining) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.budget > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded bg-muted overflow-hidden">
                            <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, r.pct)}%` }} />
                          </div>
                          <span className="text-xs font-mono">{r.pct.toFixed(0)}%</span>
                        </div>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
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

// ============================================================================
// Tab 5 — Centro de Custo
// ============================================================================
function CentroTab() {
  const { companyId } = useCurrentCompany();
  const { data: transactions = [], isLoading } = useQuery(transactionsQuery(companyId));
  const { data: centers = [] } = useQuery(costCentersQuery(companyId));

  const today = todayISO();
  const monthStart = today.slice(0, 7) + "-01";
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [drill, setDrill] = useState<string | null>(null);

  const inPeriod = (t: Transaction) => {
    const d = t.payment_date ?? t.due_date;
    return d >= from && d <= to;
  };

  const data = useMemo(() => {
    return centers.map((c) => {
      const txs = transactions.filter((t) => t.cost_center_id === c.id && inPeriod(t));
      const receita = txs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
      const despesa = txs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
      return { id: c.id, name: c.name, color: c.color ?? "#64748b", receita, despesa, resultado: receita - despesa, txs };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, centers, from, to]);

  const exportCSV = () => {
    const rows: (string | number)[][] = [["Centro", "Receitas", "Despesas", "Resultado"]];
    data.forEach((r) => rows.push([r.name, r.receita.toFixed(2), r.despesa.toFixed(2), r.resultado.toFixed(2)]));
    downloadCSV(`centros-${from}-a-${to}.csv`, rows);
  };

  if (isLoading) return <SkeletonBlock />;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-3 items-end">
          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="ml-auto">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Comparativo</CardTitle></CardHeader>
        <CardContent className="h-72">
          {data.length === 0 ? <EmptyState /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Bar dataKey="receita" name="Receitas" fill="hsl(142, 76%, 36%)" />
                <Bar dataKey="despesa" name="Despesas" fill="hsl(0, 72%, 51%)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Centro</TableHead>
                <TableHead className="text-right">Receitas</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Resultado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Sem centros de custo</TableCell></TableRow>
              )}
              {data.map((r) => (
                <>
                  <TableRow key={r.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDrill(drill === r.id ? null : r.id)}>
                    <TableCell className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color }} />
                      {r.name}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-700">{formatBRL(r.receita)}</TableCell>
                    <TableCell className="text-right font-mono text-rose-700">{formatBRL(r.despesa)}</TableCell>
                    <TableCell className={`text-right font-mono ${r.resultado >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {formatBRL(r.resultado)}
                    </TableCell>
                  </TableRow>
                  {drill === r.id && r.txs.map((t) => (
                    <TableRow key={t.id} className="bg-muted/20">
                      <TableCell className="pl-8 text-xs">{formatDateBR(t.payment_date ?? t.due_date)} — {t.description}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{t.type === "income" ? formatBRL(Number(t.amount)) : ""}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{t.type === "expense" ? formatBRL(Number(t.amount)) : ""}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Shared
// ============================================================================
function SkeletonBlock() {
  return (
    <div className="space-y-3">
      <div className="h-24 bg-muted/40 rounded animate-pulse" />
      <div className="h-64 bg-muted/40 rounded animate-pulse" />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      Sem dados no período
    </div>
  );
}
