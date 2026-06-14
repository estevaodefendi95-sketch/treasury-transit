import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { Line, LineChart, ResponsiveContainer, YAxis } from "recharts";
import {
  Percent,
  Receipt,
  Scale,
  CalendarClock,
  Sparkles,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { transactionsQuery, categoriesQuery, formatBRL, todayISO, type Transaction } from "@/lib/db";
import { indicatorsInsight } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/analises/indicadores")({
  ssr: false,
  head: () => ({ meta: [{ title: "Indicadores — Análise" }] }),
  component: IndicadoresPage,
});

type Periodo = "30" | "90" | "365";

const PAGO = new Set(["pago", "recebido"]);
// Heurística de custo (CMV) para Margem Bruta — despesas ligadas à operação/produto
const CUSTO_KEYS = ["fornecedor", "mercadoria", "matéria", "materia", "custo", "produto", "insumo", "cmv"];

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[Number(m) - 1]}/${y.slice(2)}`;
}

type CatMap = Map<string, string>;

function isCusto(t: Transaction, catNames: CatMap) {
  const nome = (t.category_id && catNames.get(t.category_id)) || "";
  const lower = nome.toLowerCase();
  return CUSTO_KEYS.some((k) => lower.includes(k));
}

type Kpis = {
  receita: number;
  despesa: number;
  custo: number;
  margemBruta: number; // %
  margemLiquida: number; // %
  ticketMedio: number;
  pontoEquilibrio: number; // mensal
  diasDeCaixa: number;
};

function computeKpis(
  txs: Transaction[],
  catNames: CatMap,
  inicio: string,
  fim: string,
  saldoAtual: number,
): Kpis {
  const noPeriodo = txs.filter((t) => {
    const ref = t.payment_date ?? t.due_date;
    return ref >= inicio && ref <= fim;
  });

  const receita = noPeriodo
    .filter((t) => t.type === "receita")
    .reduce((s, t) => s + Number(t.amount), 0);
  const despesa = noPeriodo
    .filter((t) => t.type === "despesa")
    .reduce((s, t) => s + Number(t.amount), 0);
  const custo = noPeriodo
    .filter((t) => t.type === "despesa" && isCusto(t, catNames))
    .reduce((s, t) => s + Number(t.amount), 0);

  const margemBruta = receita > 0 ? ((receita - custo) / receita) * 100 : 0;
  const margemLiquida = receita > 0 ? ((receita - despesa) / receita) * 100 : 0;

  const qtdReceitas = noPeriodo.filter((t) => t.type === "receita").length;
  const ticketMedio = qtdReceitas > 0 ? receita / qtdReceitas : 0;

  // Ponto de equilíbrio: despesa fixa (não-custo) média mensal do período
  const dias = Math.max(1, Math.round((new Date(fim).getTime() - new Date(inicio).getTime()) / 86_400_000) + 1);
  const despesaFixa = despesa - custo;
  const margemContribPct = receita > 0 ? (receita - custo) / receita : 1;
  const despesaFixaMensal = (despesaFixa / dias) * 30;
  const pontoEquilibrio = margemContribPct > 0 ? despesaFixaMensal / margemContribPct : despesaFixaMensal;

  // Dias de caixa: saldo atual / queima diária média
  const queimaDiaria = despesa / dias;
  const diasDeCaixa = queimaDiaria > 0 ? saldoAtual / queimaDiaria : 0;

  return {
    receita,
    despesa,
    custo,
    margemBruta,
    margemLiquida,
    ticketMedio,
    pontoEquilibrio,
    diasDeCaixa,
  };
}

function IndicadoresPage() {
  const { companyId } = useCurrentCompany();
  const { data: transacoes = [], isLoading } = useQuery(transactionsQuery(companyId));
  const { data: categorias = [] } = useQuery(categoriesQuery(companyId));
  const [periodo, setPeriodo] = useState<Periodo>("90");

  // Mapa de nomes de categorias para heurística de custo (CMV)
  const catNames = useMemo<CatMap>(
    () => new Map<string, string>(categorias.map((c) => [c.id, c.name])),
    [categorias],
  );

  const hoje = todayISO();
  const inicio = addDays(hoje, -Number(periodo));

  const saldoAtual = useMemo(
    () =>
      transacoes
        .filter((t) => PAGO.has(String(t.status)))
        .reduce((s, t) => s + (t.type === "receita" ? Number(t.amount) : -Number(t.amount)), 0),
    [transacoes],
  );

  const kpis = useMemo(
    () => computeKpis(transacoes, catNames, inicio, hoje, saldoAtual),
    [transacoes, catNames, inicio, hoje, saldoAtual],
  );

  // Séries dos últimos 6 meses para sparklines
  const sparks = useMemo(() => {
    const meses: string[] = [];
    const base = new Date(hoje + "T00:00:00");
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return meses.map((mk) => {
      const start = `${mk}-01`;
      const end = `${mk}-31`;
      const k = computeKpis(transacoes, catNames, start, end, saldoAtual);
      return {
        mes: monthLabel(mk),
        margemBruta: Math.round(k.margemBruta * 10) / 10,
        margemLiquida: Math.round(k.margemLiquida * 10) / 10,
        ticketMedio: Math.round(k.ticketMedio),
        pontoEquilibrio: Math.round(k.pontoEquilibrio),
        diasDeCaixa: Math.round(k.diasDeCaixa),
      };
    });
  }, [transacoes, catNames, saldoAtual, hoje]);

  const ai = useServerFn(indicatorsInsight);
  const insightMut = useMutation({
    mutationFn: () =>
      ai({
        data: {
          periodo: `últimos ${periodo} dias`,
          margem_bruta: kpis.margemBruta,
          margem_liquida: kpis.margemLiquida,
          ticket_medio: kpis.ticketMedio,
          ponto_equilibrio: kpis.pontoEquilibrio,
          dias_de_caixa: kpis.diasDeCaixa,
          receita: kpis.receita,
          despesa: kpis.despesa,
        },
      }),
  });

  const pctFmt = (n: number) => `${n.toFixed(1)}%`;
  const diasFmt = (n: number) =>
    !isFinite(n) ? "∞" : `${Math.round(n)} dia${Math.round(n) === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Indicadores"
        description="Principais KPIs de rentabilidade e saúde financeira, com tendência dos últimos 6 meses."
      />

      <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
        <TabsList>
          <TabsTrigger value="30">30 dias</TabsTrigger>
          <TabsTrigger value="90">90 dias</TabsTrigger>
          <TabsTrigger value="365">12 meses</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-36 bg-muted/40 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            icon={<Percent className="h-4 w-4" />}
            label="Margem Bruta"
            value={pctFmt(kpis.margemBruta)}
            help="(Receita − Custos) ÷ Receita"
            data={sparks}
            dataKey="margemBruta"
            color="hsl(142, 76%, 36%)"
            goodWhenUp
          />
          <KpiCard
            icon={<Percent className="h-4 w-4" />}
            label="Margem Líquida"
            value={pctFmt(kpis.margemLiquida)}
            help="(Receita − Despesas) ÷ Receita"
            data={sparks}
            dataKey="margemLiquida"
            color="hsl(217, 91%, 60%)"
            goodWhenUp
          />
          <KpiCard
            icon={<Receipt className="h-4 w-4" />}
            label="Ticket Médio"
            value={formatBRL(kpis.ticketMedio)}
            help="Receita ÷ nº de recebimentos"
            data={sparks}
            dataKey="ticketMedio"
            color="hsl(262, 83%, 58%)"
            goodWhenUp
          />
          <KpiCard
            icon={<Scale className="h-4 w-4" />}
            label="Ponto de Equilíbrio"
            value={formatBRL(kpis.pontoEquilibrio)}
            help="Receita mensal para cobrir custos fixos"
            data={sparks}
            dataKey="pontoEquilibrio"
            color="hsl(38, 92%, 50%)"
            goodWhenUp={false}
          />
          <KpiCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="Dias de Caixa"
            value={diasFmt(kpis.diasDeCaixa)}
            help="Saldo atual ÷ queima diária média"
            data={sparks}
            dataKey="diasDeCaixa"
            color="hsl(199, 89%, 48%)"
            goodWhenUp
          />
        </div>
      )}

      <Card className="border-violet-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            Análise inteligente dos indicadores
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => insightMut.mutate()}
            disabled={insightMut.isPending || isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${insightMut.isPending ? "animate-spin" : ""}`} />
            {insightMut.data ? "Atualizar" : "Gerar análise"}
          </Button>
        </CardHeader>
        <CardContent>
          {insightMut.isPending ? (
            <div className="text-sm text-muted-foreground italic">🤖 Analisando indicadores…</div>
          ) : insightMut.data ? (
            <div className="text-sm leading-relaxed whitespace-pre-wrap flex gap-3">
              <span className="text-xl leading-none">🤖</span>
              <span>{insightMut.data.insight}</span>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Clique em "Gerar análise" para uma avaliação por IA dos seus indicadores.
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Custos (CMV) são estimados por categorias ligadas a fornecedores, mercadorias e insumos. Para
        maior precisão, classifique as despesas operacionais nessas categorias.
      </p>
    </div>
  );
}

function trend(data: { [k: string]: number | string }[], key: string) {
  const vals = data.map((d) => Number(d[key]));
  if (vals.length < 2) return 0;
  const first = vals[0];
  const last = vals[vals.length - 1];
  if (first === 0) return last > 0 ? 100 : 0;
  return ((last - first) / Math.abs(first)) * 100;
}

function KpiCard({
  icon,
  label,
  value,
  help,
  data,
  dataKey,
  color,
  goodWhenUp,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  help: string;
  data: { mes: string; [k: string]: number | string }[];
  dataKey: string;
  color: string;
  goodWhenUp: boolean;
}) {
  const delta = trend(data, dataKey);
  const up = delta >= 0;
  const positive = goodWhenUp ? up : !up;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            {icon}
            {label}
          </div>
          {Math.abs(delta) > 0.1 && (
            <span
              className={`text-[11px] font-medium flex items-center gap-0.5 ${
                positive ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
        </div>
        <div className="text-2xl font-bold mt-1">{value}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{help}</div>
        <div className="h-12 mt-2 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">Tendência — últimos 6 meses</div>
      </CardContent>
    </Card>
  );
}
