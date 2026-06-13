import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  costCentersQuery,
  transactionsQuery,
  categoriesQuery,
  formatBRL,
  todayISO,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/centros-de-custo/relatorio")({
  ssr: false,
  head: () => ({ meta: [{ title: "Relatório de Centros de Custo" }] }),
  component: RelatorioPage,
});

function RelatorioPage() {
  const { companyId } = useCurrentCompany();
  const { data: centers = [] } = useQuery(costCentersQuery(companyId));
  const { data: transactions = [] } = useQuery(transactionsQuery(companyId));
  const { data: categories = [] } = useQuery(categoriesQuery(companyId));

  const today = todayISO();
  const monthStart = today.slice(0, 7) + "-01";
  const [centerId, setCenterId] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const d = t.payment_date ?? t.due_date;
      if (d < from || d > to) return false;
      if (centerId && t.cost_center_id !== centerId) return false;
      if (!centerId && !t.cost_center_id) return false;
      return true;
    });
  }, [transactions, from, to, centerId]);

  const totals = useMemo(() => {
    const receita = filtered.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
    const despesa = filtered.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
    return { receita, despesa, resultado: receita - despesa };
  }, [filtered]);

  const perCenter = useMemo(() => {
    const m: Record<string, { receita: number; despesa: number }> = {};
    for (const t of filtered) {
      const k = t.cost_center_id ?? "—";
      if (!m[k]) m[k] = { receita: 0, despesa: 0 };
      if (t.type === "receita") m[k].receita += Number(t.amount);
      else m[k].despesa += Number(t.amount);
    }
    return Object.entries(m).map(([id, v]) => {
      const c = centers.find((x) => x.id === id);
      return { id, name: c?.name ?? "Sem centro", color: c?.color ?? "#94a3b8", ...v };
    });
  }, [filtered, centers]);

  const perCategory = useMemo(() => {
    const m: Record<string, { receita: number; despesa: number }> = {};
    for (const t of filtered) {
      const k = t.category_id ?? "—";
      if (!m[k]) m[k] = { receita: 0, despesa: 0 };
      if (t.type === "receita") m[k].receita += Number(t.amount);
      else m[k].despesa += Number(t.amount);
    }
    return Object.entries(m).map(([id, v]) => {
      const c = categories.find((x) => x.id === id);
      return { id, name: c?.name ?? "Sem categoria", icon: c?.icon ?? "", ...v };
    }).sort((a, b) => b.despesa - a.despesa);
  }, [filtered, categories]);

  const maxBar = Math.max(1, ...perCenter.map((c) => Math.max(c.receita, c.despesa)));

  const exportCSV = () => {
    const rows = [
      ["Centro", "Categoria", "Tipo", "Data", "Descrição", "Valor"],
      ...filtered.map((t) => {
        const c = centers.find((x) => x.id === t.cost_center_id);
        const cat = categories.find((x) => x.id === t.category_id);
        return [
          c?.name ?? "—",
          cat?.name ?? "—",
          t.type,
          t.payment_date ?? t.due_date,
          t.description.replace(/"/g, "'"),
          Number(t.amount).toFixed(2),
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `centros-de-custo-${from}-a-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório de Centros de Custo"
        description="Compare desempenho por centro e categoria."
        actions={
          <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-4 pt-6">
          <div className="space-y-1">
            <Label>Centro</Label>
            <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={centerId} onChange={(e) => setCenterId(e.target.value)}>
              <option value="">Todos</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label>De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="pt-6">
          <div className="text-xs text-muted-foreground">Total Receitas</div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">{formatBRL(totals.receita)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-xs text-muted-foreground">Total Despesas</div>
          <div className="text-2xl font-bold text-rose-600 font-mono">{formatBRL(totals.despesa)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-xs text-muted-foreground">Resultado</div>
          <div className={`text-2xl font-bold font-mono ${totals.resultado >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {formatBRL(totals.resultado)}
          </div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Comparativo por Centro</CardTitle></CardHeader>
        <CardContent>
          {perCenter.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">Sem dados no período</div>
          ) : (
            <div className="space-y-3">
              {perCenter.map((c) => (
                <div key={c.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                    <span className="font-mono">
                      <span className="text-emerald-600">{formatBRL(c.receita)}</span>
                      {" / "}
                      <span className="text-rose-600">{formatBRL(c.despesa)}</span>
                    </span>
                  </div>
                  <div className="flex gap-1 h-3">
                    <div className="bg-emerald-500 rounded-l" style={{ width: `${(c.receita / maxBar) * 50}%` }} />
                    <div className="bg-rose-500 rounded-r" style={{ width: `${(c.despesa / maxBar) * 50}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Breakdown por Categoria</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Receitas</TableHead>
                <TableHead className="text-right">Despesas</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perCategory.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Sem dados</TableCell></TableRow>
              )}
              {perCategory.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.icon} {c.name}</TableCell>
                  <TableCell className="text-right text-emerald-600 font-mono">{formatBRL(c.receita)}</TableCell>
                  <TableCell className="text-right text-rose-600 font-mono">{formatBRL(c.despesa)}</TableCell>
                  <TableCell className={`text-right font-mono ${c.receita - c.despesa >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {formatBRL(c.receita - c.despesa)}
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
