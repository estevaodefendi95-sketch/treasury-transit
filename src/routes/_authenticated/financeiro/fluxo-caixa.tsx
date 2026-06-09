import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Area, AreaChart } from "recharts";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { transactionsQuery, formatBRL, type Transaction } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/financeiro/fluxo-caixa")({
  ssr: false,
  head: () => ({ meta: [{ title: "Fluxo de Caixa — SuaEmpresa Gestão" }] }),
  component: FluxoCaixaPage,
});

function FluxoCaixaPage() {
  const { companyId } = useCurrentCompany();
  const { data: transacoes = [] } = useQuery(transactionsQuery(companyId));

  const porDia = transacoes.reduce<Record<string, { dia: string; entradas: number; saidas: number }>>((acc, t: Transaction) => {
    const ref = t.payment_date ?? t.due_date;
    if (!ref) return acc;
    const dia = ref.slice(8, 10) + "/" + ref.slice(5, 7);
    if (!acc[dia]) acc[dia] = { dia, entradas: 0, saidas: 0 };
    if (t.type === "income") acc[dia].entradas += Number(t.amount);
    else if (t.type === "expense") acc[dia].saidas += Number(t.amount);
    return acc;
  }, {});

  const dados = Object.values(porDia)
    .sort((a, b) => a.dia.localeCompare(b.dia))
    .map((d) => ({ ...d, saldo: d.entradas - d.saidas }));

  const acumulado = dados.reduce<Array<{ dia: string; acumulado: number }>>((acc, d, i) => {
    const prev = i > 0 ? acc[i - 1].acumulado : 0;
    acc.push({ dia: d.dia, acumulado: prev + d.saldo });
    return acc;
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Fluxo de Caixa" description="Análise temporal de entradas e saídas." />
      <Card>
        <CardHeader><CardTitle className="text-base">Entradas vs Saídas por dia</CardTitle></CardHeader>
        <CardContent className="h-80">
          {dados.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Sem dados de transações ainda.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dados}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
                <Line type="monotone" dataKey="entradas" stroke="hsl(142, 76%, 36%)" strokeWidth={2} />
                <Line type="monotone" dataKey="saidas" stroke="hsl(0, 72%, 51%)" strokeWidth={2} />
                <Line type="monotone" dataKey="saldo" stroke="hsl(217, 91%, 60%)" strokeWidth={2} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">Saldo acumulado</CardTitle></CardHeader>
        <CardContent className="h-64">
          {acumulado.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">—</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={acumulado}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Area type="monotone" dataKey="acumulado" stroke="hsl(217, 91%, 60%)" fill="hsl(217, 91%, 60% / 0.2)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
