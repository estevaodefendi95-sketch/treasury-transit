import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore, formatBRL } from "@/store/useStore";
import { ArrowUpRight, ArrowDownRight, Wallet, AlertCircle } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SuaEmpresa Gestão" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { transacoes, contasPagar, contasReceber } = useAppStore();

  const receitas = transacoes.filter((t) => t.tipo === "receita").reduce((s, t) => s + t.valor, 0);
  const despesas = transacoes.filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0);
  const saldo = receitas - despesas;
  const aPagar = contasPagar.filter((c) => c.status !== "pago").reduce((s, c) => s + c.valor, 0);
  const aReceber = contasReceber.filter((c) => c.status !== "recebido").reduce((s, c) => s + c.valor, 0);
  const atrasados = [...contasPagar, ...contasReceber].filter((c) => c.status === "atrasado").length;

  // Agrupar por dia para o gráfico
  const porDia = transacoes.reduce<Record<string, { dia: string; receita: number; despesa: number }>>(
    (acc, t) => {
      const dia = t.data.slice(8, 10) + "/" + t.data.slice(5, 7);
      if (!acc[dia]) acc[dia] = { dia, receita: 0, despesa: 0 };
      if (t.tipo === "receita") acc[dia].receita += t.valor;
      else acc[dia].despesa += t.valor;
      return acc;
    },
    {}
  );
  const chartData = Object.values(porDia).sort((a, b) => a.dia.localeCompare(b.dia));

  const cards = [
    { label: "Saldo Atual", value: saldo, icon: Wallet, color: "text-primary", bg: "bg-primary/10" },
    { label: "Receitas", value: receitas, icon: ArrowDownRight, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Despesas", value: despesas, icon: ArrowUpRight, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10" },
    { label: "A Pagar", value: aPagar, icon: AlertCircle, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Visão geral financeira da sua empresa." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                  <p className="text-2xl font-bold mt-1 text-foreground">{formatBRL(c.value)}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg ${c.bg} flex items-center justify-center`}>
                  <c.icon className={`h-5 w-5 ${c.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Receitas vs Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="dia" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(v) => `R$${v / 1000}k`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Bar dataKey="receita" fill="hsl(142 76% 40%)" name="Receita" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesa" fill="hsl(0 70% 55%)" name="Despesa" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">A Receber</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatBRL(aReceber)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {contasReceber.filter((c) => c.status !== "recebido").length} contas pendentes
            </p>
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">Itens atrasados</p>
              <p className="text-xl font-semibold text-rose-600 dark:text-rose-400">{atrasados}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas transações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {transacoes.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.descricao}</p>
                  <p className="text-xs text-muted-foreground">{t.categoria} · {t.data}</p>
                </div>
                <p className={`text-sm font-semibold ${t.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                  {t.tipo === "receita" ? "+" : "-"} {formatBRL(t.valor)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
