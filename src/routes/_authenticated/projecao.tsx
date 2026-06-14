import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp } from "lucide-react";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { transactionsQuery, formatBRL } from "@/lib/db";
import { computeProjection, computeBreakeven } from "@/lib/projection";
import { cashflowNarrative } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/projecao")({
  ssr: false,
  head: () => ({ meta: [{ title: "Projeção de Fluxo de Caixa" }] }),
  component: ProjecaoPage,
});

function ProjecaoPage() {
  const { companyId } = useCurrentCompany();
  const { data: transacoes = [], isLoading } = useQuery(
    transactionsQuery(companyId),
  );
  const [days, setDays] = useState<30 | 60 | 90>(30);
  const [advance, setAdvance] = useState<string>("");

  const advanceNum = Math.max(0, Number(advance.replace(",", ".")) || 0);

  const base = useMemo(
    () => computeProjection(transacoes, days),
    [transacoes, days],
  );
  const simulated = useMemo(
    () =>
      advanceNum > 0
        ? computeProjection(transacoes, days, {
            advanceReceivables: advanceNum,
          })
        : null,
    [transacoes, days, advanceNum],
  );
  const breakeven = useMemo(() => computeBreakeven(transacoes), [transacoes]);

  // Agrupamento por faixa de tempo (0-30 / 31-60 / 61-90 dias) das previsões
  const buckets = useMemo(() => {
    const DEAD = new Set(["pago", "recebido", "cancelado"]);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const faixas = [
      { label: "0–30 dias", min: 0, max: 30, entradas: 0, saidas: 0 },
      { label: "31–60 dias", min: 31, max: 60, entradas: 0, saidas: 0 },
      { label: "61–90 dias", min: 61, max: 90, entradas: 0, saidas: 0 },
    ];
    for (const t of transacoes) {
      if (DEAD.has(String(t.status))) continue;
      if (!t.due_date) continue;
      const diff = Math.round(
        (new Date(t.due_date + "T00:00:00").getTime() - hoje.getTime()) / 86_400_000,
      );
      if (diff < 0 || diff > days) continue;
      const f = faixas.find((x) => diff >= x.min && diff <= x.max);
      if (!f) continue;
      if (t.type === "receita") f.entradas += Number(t.amount);
      else if (t.type === "despesa") f.saidas += Number(t.amount);
    }
    return faixas.filter((f) => f.min < days || f.label.startsWith("0"));
  }, [transacoes, days]);

  const ai = useServerFn(cashflowNarrative);
  const narrativeMut = useMutation({
    mutationFn: () =>
      ai({
        data: {
          days,
          current_balance: base.currentBalance,
          scheduled_receivables: base.scheduledReceivables,
          scheduled_payables: base.scheduledPayables,
          overdue_receivables: base.overdueReceivables,
          projected_balance: base.projectedBalance,
        },
      }),
  });

  const projection = simulated ?? base;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projeção de Fluxo de Caixa"
        description="Veja o saldo confirmado e projetado para os próximos dias."
      />

      <div className="flex items-center justify-between">
        <Tabs
          value={String(days)}
          onValueChange={(v) => setDays(Number(v) as 30 | 60 | 90)}
        >
          <TabsList>
            <TabsTrigger value="30">30 dias</TabsTrigger>
            <TabsTrigger value="60">60 dias</TabsTrigger>
            <TabsTrigger value="90">90 dias</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard">Voltar ao dashboard</Link>
        </Button>
      </div>

      {base.daysToNegative !== null && (
        <Card className="border-rose-300 bg-rose-50">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-700" />
            <div className="text-sm text-rose-900">
              <span className="font-semibold">
                ⚠️ Saldo projetado negativo em {base.daysToNegative} dia
                {base.daysToNegative === 1 ? "" : "s"}.
              </span>{" "}
              Reveja seus pagamentos ou antecipe recebíveis.
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Saldo atual" value={base.currentBalance} />
        <KpiCard
          label="A receber (período)"
          value={base.scheduledReceivables}
          tone="text-emerald-600"
        />
        <KpiCard
          label="A pagar (período)"
          value={base.scheduledPayables}
          tone="text-rose-600"
        />
        <KpiCard
          label={`Projeção ${days}d`}
          value={projection.projectedBalance}
          tone={
            projection.projectedBalance < 0
              ? "text-rose-600"
              : "text-sky-600"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Projeção diária — próximos {days} dias
          </CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Carregando…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projection.points}>
                <defs>
                  <linearGradient id="confColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="projColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="dia" fontSize={11} />
                <YAxis
                  fontSize={11}
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <ReferenceLine
                  y={0}
                  stroke="hsl(0, 72%, 51%)"
                  strokeDasharray="4 4"
                  label={{ value: "R$ 0", position: "insideTopRight", fontSize: 10, fill: "hsl(0, 72%, 51%)" }}
                />
                <Area
                  type="monotone"
                  dataKey="confirmado"
                  name="Confirmado"
                  stroke="hsl(142, 76%, 36%)"
                  fill="url(#confColor)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="projetado"
                  name="Projetado"
                  stroke="hsl(217, 91%, 60%)"
                  fill="url(#projColor)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Análise inteligente
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => narrativeMut.mutate()}
              disabled={narrativeMut.isPending || isLoading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1 ${narrativeMut.isPending ? "animate-spin" : ""}`}
              />
              {narrativeMut.data ? "Atualizar análise" : "Gerar análise"}
            </Button>
          </CardHeader>
          <CardContent>
            {narrativeMut.isPending ? (
              <div className="text-sm text-muted-foreground italic">
                🤖 Analisando fluxo de caixa…
              </div>
            ) : narrativeMut.data ? (
              <div className="text-sm leading-relaxed whitespace-pre-wrap flex gap-3">
                <span className="text-xl leading-none">🤖</span>
                <span>{narrativeMut.data.narrative}</span>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Clique em "Gerar análise" para uma avaliação por IA do seu fluxo de caixa.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-sky-600" />
              Ponto de equilíbrio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(breakeven)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              receita mensal necessária para cobrir despesas (média 90 dias).
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Previsões por faixa de tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {buckets.map((f) => {
              const saldo = f.entradas - f.saidas;
              return (
                <div key={f.label} className="rounded-lg border p-3">
                  <div className="text-xs font-medium text-muted-foreground">{f.label}</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-700">Entradas</span>
                      <span className="font-mono text-emerald-700">{formatBRL(f.entradas)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-rose-700">Saídas</span>
                      <span className="font-mono text-rose-700">{formatBRL(f.saidas)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm border-t pt-1 mt-1">
                      <span className="font-medium">Saldo</span>
                      <span className={`font-mono font-semibold ${saldo >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatBRL(saldo)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Simulador de antecipação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="advance">
                E se eu antecipar quanto em recebíveis hoje?
              </Label>
              <Input
                id="advance"
                inputMode="decimal"
                placeholder="0,00"
                value={advance}
                onChange={(e) => setAdvance(e.target.value)}
              />
            </div>
            {simulated && (
              <div className="text-sm flex flex-col justify-center">
                <div className="text-muted-foreground text-xs">
                  Saldo em {days}d
                </div>
                <div className="font-medium">
                  {formatBRL(base.projectedBalance)} →{" "}
                  <span className="text-emerald-600">
                    {formatBRL(simulated.projectedBalance)}
                  </span>{" "}
                  <span className="text-xs text-emerald-700">
                    (+
                    {formatBRL(
                      simulated.projectedBalance - base.projectedBalance,
                    )}
                    )
                  </span>
                </div>
              </div>
            )}
          </div>
          {advanceNum > 0 && (
            <div className="text-xs text-muted-foreground">
              Simulação distribui a antecipação proporcionalmente nos recebíveis dos próximos {days} dias.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-bold mt-1 ${tone ?? ""}`}>
          {formatBRL(value)}
        </div>
      </CardContent>
    </Card>
  );
}
