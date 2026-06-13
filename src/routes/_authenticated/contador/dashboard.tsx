import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, Building2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { transactionsQuery, costCentersQuery, formatBRL } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/contador/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard do Contador" }] }),
  component: ContadorDashboard,
});

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ContadorDashboard() {
  const { companyId, company } = useCurrentCompany();
  const { data: tx = [] } = useQuery(transactionsQuery(companyId));
  const { data: costCenters = [] } = useQuery(costCentersQuery(companyId));

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const filtered = useMemo(() => {
    return tx.filter((t) => {
      const d = new Date(t.due_date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    });
  }, [tx, year, month]);

  const receitas = filtered.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
  const despesas = filtered.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
  const resultado = receitas - despesas;
  const saldo = tx
    .filter((t) => t.status === "pago" || t.status === "recebido")
    .reduce((s, t) => s + (t.type === "receita" ? Number(t.amount) : -Number(t.amount)), 0);

  const exportDRE = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>DRE ${month}/${year}</title>
      <style>body{font-family:system-ui;padding:40px;color:#111}h1{margin:0}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}td.r{text-align:right}</style>
      </head><body>
      <h1>DRE — ${company?.name ?? ""}</h1>
      <p>Período: ${String(month).padStart(2, "0")}/${year}</p>
      <table>
        <tr><th>Linha</th><th class="r">Valor</th></tr>
        <tr><td>(+) Receitas</td><td class="r">${formatBRL(receitas)}</td></tr>
        <tr><td>(-) Despesas</td><td class="r">${formatBRL(despesas)}</td></tr>
        <tr><td><strong>(=) Resultado</strong></td><td class="r"><strong>${formatBRL(resultado)}</strong></td></tr>
      </table>
      <script>window.print()</script>
      </body></html>`);
  };

  const exportCSV = () => {
    const rows: (string | number)[][] = [["Data", "Tipo", "Descrição", "Valor", "Status"]];
    filtered.forEach((t) => rows.push([t.due_date, t.type, t.description, t.amount, t.status ?? ""]));
    downloadCSV(`lancamentos_${year}_${String(month).padStart(2, "0")}.csv`, rows);
  };

  const exportByCostCenter = () => {
    const rows: (string | number)[][] = [["Centro de Custo", "Receitas", "Despesas", "Resultado"]];
    costCenters.forEach((cc) => {
      const ccTx = filtered.filter((t) => t.cost_center_id === cc.id);
      const r = ccTx.filter((t) => t.type === "receita").reduce((s, t) => s + Number(t.amount), 0);
      const d = ccTx.filter((t) => t.type === "despesa").reduce((s, t) => s + Number(t.amount), 0);
      rows.push([cc.name, r, d, r - d]);
    });
    downloadCSV(`centro_custo_${year}_${String(month).padStart(2, "0")}.csv`, rows);
  };

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Resumo Contábil" description="Visualização somente-leitura para o contador" />

      <div className="flex gap-2 flex-wrap">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Receitas do mês</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{formatBRL(receitas)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Despesas do mês</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-red-600">{formatBRL(despesas)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Resultado</CardTitle></CardHeader><CardContent><div className={`text-xl font-bold ${resultado >= 0 ? "text-green-600" : "text-red-600"}`}>{formatBRL(resultado)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Saldo realizado</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatBRL(saldo)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Exportações Rápidas</CardTitle></CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Button onClick={exportDRE}><FileText className="h-4 w-4 mr-2" />Exportar DRE (PDF)</Button>
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Exportar Lançamentos (CSV)</Button>
          <Button variant="outline" onClick={exportByCostCenter}><Building2 className="h-4 w-4 mr-2" />Por Centro de Custo (CSV)</Button>
        </CardContent>
      </Card>
    </div>
  );
}
