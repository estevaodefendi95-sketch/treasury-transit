import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { ArrowUpRight, ArrowDownRight, Wallet, AlertCircle, ClipboardCheck, Sparkles, AlertTriangle, Lock } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Legend } from "recharts";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { transactionsQuery, formatBRL, isOverdue, type Transaction } from "@/lib/db";
import { computeProjection } from "@/lib/projection";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Dashboard — SuaEmpresa Gestão" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { companyId, profile, company } = useCurrentCompany();
  const { data: transacoes = [], isLoading } = useQuery(transactionsQuery(companyId));
  const isAdmin = profile?.role === "admin";
  const lockedUntil = company?.locked_until ?? null;
  const pendingApprovals = transacoes.filter((t) => t.approval_status === "aguardando_aprovacao");
  const projection30 = transacoes.length > 0 ? computeProjection(transacoes, 30) : null;

  const receitas = transacoes.filter((t) => t.type === "receita" && (t.status === "recebido" || t.status === "pago")).reduce((s, t) => s + Number(t.amount), 0);
  const despesas = transacoes.filter((t) => t.type === "despesa" && (t.status === "pago")).reduce((s, t) => s + Number(t.amount), 0);
  const saldo = receitas - despesas;
  const aPagar = transacoes.filter((t) => t.type === "despesa" && t.status !== "pago" && t.status !== "cancelado").reduce((s, t) => s + Number(t.amount), 0);
  const aReceber = transacoes.filter((t) => t.type === "receita" && t.status !== "recebido" && t.status !== "pago" && t.status !== "cancelado").reduce((s, t) => s + Number(t.amount), 0);
  const atrasados = transacoes.filter(isOverdue).length;

  // Agrupar por dia (últimos 30 dias) para o gráfico
  const porDia = transacoes.reduce<Record<string, { dia: string; receita: number; despesa: number }>>((acc, t: Transaction) => {
    const ref = t.payment_date ?? t.due_date;
    if (!ref) return acc;
    const dia = ref.slice(8, 10) + "/" + ref.slice(5, 7);
    if (!acc[dia]) acc[dia] = { dia, receita: 0, despesa: 0 };
    if (t.type === "receita") acc[dia].receita += Number(t.amount);
    else if (t.type === "despesa") acc[dia].despesa += Number(t.amount);
    return acc;
  }, {});
  const chartData = Object.values(porDia).sort((a, b) => a.dia.localeCompare(b.dia)).slice(-14);

  const kpis = [
    { label: "Receitas (realizadas)", value: receitas, icon: ArrowDownRight, tone: "text-emerald-600" },
    { label: "Despesas (realizadas)", value: despesas, icon: ArrowUpRight, tone: "text-rose-600" },
    { label: "Saldo", value: saldo, icon: Wallet, tone: saldo >= 0 ? "text-emerald-600" : "text-rose-600" },
    { label: "A receber", value: aReceber, icon: ArrowDownRight, tone: "text-sky-600" },
    { label: "A pagar", value: aPagar, icon: ArrowUpRight, tone: "text-amber-600" },
    { label: "Atrasados", value: atrasados, icon: AlertCircle, tone: "text-rose-600", count: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Visão geral financeira da empresa." />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : (
        <>
          {lockedUntil && (
            <Card className="border-slate-300 bg-slate-50">
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Lock className="h-5 w-5 text-slate-700" />
                <div className="text-sm text-slate-800">
                  Período até <span className="font-semibold">{lockedUntil}</span> está fechado para edição.
                </div>
              </CardContent>
            </Card>
          )}
          {isAdmin && pendingApprovals.length > 0 && (
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ClipboardCheck className="h-6 w-6 text-amber-700" />
                  <div>
                    <div className="font-semibold text-amber-900">
                      {pendingApprovals.length} lançamento{pendingApprovals.length !== 1 ? "s" : ""} aguardando aprovação
                    </div>
                    <div className="text-xs text-amber-800">
                      Total: {formatBRL(pendingApprovals.reduce((s, t) => s + Number(t.amount), 0))}
                    </div>
                  </div>
                </div>
                <Button asChild variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700">
                  <Link to="/aprovacoes">Revisar fila</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          {projection30 && projection30.daysToNegative !== null && (
            <Card className="border-rose-300 bg-rose-50">
              <CardContent className="pt-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-6 w-6 text-rose-700" />
                  <div>
                    <div className="font-semibold text-rose-900">
                      ⚠️ Saldo projetado negativo em {projection30.daysToNegative} dia{projection30.daysToNegative === 1 ? "" : "s"}
                    </div>
                    <div className="text-xs text-rose-800">
                      Projeção em 30d: {formatBRL(projection30.projectedBalance)}
                    </div>
                  </div>
                </div>
                <Button asChild variant="default" size="sm" className="bg-rose-600 hover:bg-rose-700">
                  <Link to="/projecao">
                    <Sparkles className="h-3.5 w-3.5 mr-1" />
                    Ver projeção
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpis.map((k) => (
              <Card key={k.label} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{k.label}</span>
                    <k.icon className={`h-4 w-4 ${k.tone}`} />
                  </div>
                  <div className={`text-lg font-bold mt-1 ${k.tone}`}>
                    {k.count ? k.value : formatBRL(k.value)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Receitas vs Despesas (últimos 14 dias)</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Sem dados de transações ainda. Cadastre na seção Financeiro.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Legend />
                    <Bar dataKey="receita" name="Receita" fill="hsl(142, 76%, 36%)" />
                    <Bar dataKey="despesa" name="Despesa" fill="hsl(0, 72%, 51%)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tendência de saldo acumulado</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">—</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.reduce<Array<{ dia: string; saldo: number }>>((acc, c, i) => {
                    const prev = i > 0 ? acc[i - 1].saldo : 0;
                    acc.push({ dia: c.dia, saldo: prev + c.receita - c.despesa });
                    return acc;
                  }, [])}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} />
                    <Line type="monotone" dataKey="saldo" stroke="hsl(217, 91%, 60%)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
