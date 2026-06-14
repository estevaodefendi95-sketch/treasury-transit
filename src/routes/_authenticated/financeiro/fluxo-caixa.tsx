import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
  ReferenceLine,
} from "recharts";
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, Wallet } from "lucide-react";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  transactionsQuery,
  categoriesQuery,
  bankAccountsQuery,
  formatBRL,
  formatDateBR,
  todayISO,
  type Transaction,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/financeiro/fluxo-caixa")({
  ssr: false,
  head: () => ({ meta: [{ title: "Fluxo de Caixa — Análise" }] }),
  component: FluxoCaixaPage,
});

type Periodo = "7" | "30" | "90" | "365";
type Visao = "realizado" | "previsto" | "todos";

const PAGO = new Set(["pago", "recebido"]);
const VIVO = new Set(["pendente", "vencido"]);

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function monthKey(iso: string) {
  return iso.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[Number(m) - 1]}/${y.slice(2)}`;
}

function FluxoCaixaPage() {
  const { companyId } = useCurrentCompany();
  const { data: transacoes = [], isLoading } = useQuery(transactionsQuery(companyId));
  const { data: categorias = [] } = useQuery(categoriesQuery(companyId));
  const { data: contas = [] } = useQuery(bankAccountsQuery(companyId));

  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [visao, setVisao] = useState<Visao>("realizado");
  const [contaFiltro, setContaFiltro] = useState<string>("todas");

  const hoje = todayISO();
  const inicio = addDays(hoje, -Number(periodo));
  const agrupaPorMes = periodo === "365";

  const filtradas = useMemo<Transaction[]>(() => {
    return transacoes.filter((t) => {
      if (contaFiltro !== "todas" && t.bank_account_id !== contaFiltro) return false;
      const ref = t.payment_date ?? t.due_date;
      if (!ref || ref < inicio || ref > addDays(hoje, agrupaPorMes ? 0 : Number(periodo))) {
        // pro 12m: olhar últimos 12m até hoje; para previsto também futuros
      }
      const st = String(t.status ?? "");
      if (visao === "realizado" && !PAGO.has(st)) return false;
      if (visao === "previsto" && !VIVO.has(st)) return false;
      // janela temporal
      const dataRef = visao === "realizado" ? t.payment_date ?? t.due_date : t.due_date;
      if (!dataRef) return false;
      if (dataRef < inicio) return false;
      // permitir futuros em "previsto" e "todos" até hoje+período
      const limiteFim = visao === "realizado" ? hoje : addDays(hoje, Number(periodo));
      if (dataRef > limiteFim) return false;
      return true;
    });
  }, [transacoes, contaFiltro, visao, inicio, periodo, hoje, agrupaPorMes]);

  // KPIs
  const totalEntradas = filtradas
    .filter((t) => t.type === "receita")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalSaidas = filtradas
    .filter((t) => t.type === "despesa")
    .reduce((s, t) => s + Number(t.amount), 0);
  const saldoPeriodo = totalEntradas - totalSaidas;

  // Saldo atual (todos os pagos/recebidos da empresa, com filtro de conta)
  const saldoAtual = transacoes
    .filter((t) => (contaFiltro === "todas" || t.bank_account_id === contaFiltro) && PAGO.has(String(t.status)))
    .reduce((s, t) => s + (t.type === "receita" ? Number(t.amount) : -Number(t.amount)), 0);

  // Série temporal
  const serie = useMemo(() => {
    const buckets: Record<string, { rotulo: string; entradas: number; saidas: number }> = {};
    for (const t of filtradas) {
      const ref = visao === "realizado" ? t.payment_date ?? t.due_date : t.due_date;
      if (!ref) continue;
      const key = agrupaPorMes ? monthKey(ref) : ref;
      const rotulo = agrupaPorMes ? monthLabel(key) : formatDateBR(ref).slice(0, 5);
      if (!buckets[key]) buckets[key] = { rotulo, entradas: 0, saidas: 0 };
      if (t.type === "receita") buckets[key].entradas += Number(t.amount);
      else if (t.type === "despesa") buckets[key].saidas += Number(t.amount);
    }
    const ordenado = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({ ...v, saldo: v.entradas - v.saidas }));
    let acc = 0;
    return ordenado.map((d) => {
      acc += d.saldo;
      return { ...d, acumulado: Math.round(acc * 100) / 100 };
    });
  }, [filtradas, visao, agrupaPorMes]);

  // Top categorias
  const catMap = new Map(categorias.map((c) => [c.id, c.name]));
  const topCategorias = (tipo: "receita" | "despesa") => {
    const m = new Map<string, number>();
    for (const t of filtradas) {
      if (t.type !== tipo) continue;
      const nome = (t.category_id && catMap.get(t.category_id)) || "Sem categoria";
      m.set(nome, (m.get(nome) ?? 0) + Number(t.amount));
    }
    const total = [...m.values()].reduce((s, v) => s + v, 0);
    return [...m.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([nome, valor]) => ({ nome, valor, pct: total > 0 ? (valor / total) * 100 : 0 }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fluxo de Caixa"
        description={`Análise de ${formatDateBR(inicio)} até ${formatDateBR(visao === "realizado" ? hoje : addDays(hoje, Number(periodo)))}.`}
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <TabsList>
            <TabsTrigger value="7">7 dias</TabsTrigger>
            <TabsTrigger value="30">30 dias</TabsTrigger>
            <TabsTrigger value="90">90 dias</TabsTrigger>
            <TabsTrigger value="365">12 meses</TabsTrigger>
          </TabsList>
        </Tabs>
        <Tabs value={visao} onValueChange={(v) => setVisao(v as Visao)}>
          <TabsList>
            <TabsTrigger value="realizado">Realizado</TabsTrigger>
            <TabsTrigger value="previsto">Previsto</TabsTrigger>
            <TabsTrigger value="todos">Todos</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={contaFiltro} onValueChange={setContaFiltro}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Conta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as contas</SelectItem>
            {contas.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={<Wallet className="h-4 w-4" />} label="Saldo atual" value={saldoAtual} tone={saldoAtual < 0 ? "text-rose-600" : ""} />
        <Kpi icon={<ArrowUpCircle className="h-4 w-4 text-emerald-600" />} label="Entradas no período" value={totalEntradas} tone="text-emerald-600" />
        <Kpi icon={<ArrowDownCircle className="h-4 w-4 text-rose-600" />} label="Saídas no período" value={totalSaidas} tone="text-rose-600" />
        <Kpi icon={<TrendingUp className="h-4 w-4 text-sky-600" />} label="Resultado do período" value={saldoPeriodo} tone={saldoPeriodo < 0 ? "text-rose-600" : "text-sky-600"} />
      </div>

      {/* Barras entradas vs saídas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entradas vs Saídas {agrupaPorMes ? "(por mês)" : "(por dia)"}</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando…</div>
          ) : serie.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem movimentações no período.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="rotulo" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
                <Bar dataKey="entradas" name="Entradas" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Saldo acumulado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saldo acumulado no período</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {serie.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">—</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie}>
                <defs>
                  <linearGradient id="accColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="rotulo" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <ReferenceLine y={0} stroke="hsl(0, 72%, 51%)" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke="hsl(217, 91%, 60%)" fill="url(#accColor)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Top categorias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopCategorias titulo="Top 5 entradas por categoria" cor="bg-emerald-500" itens={topCategorias("receita")} />
        <TopCategorias titulo="Top 5 saídas por categoria" cor="bg-rose-500" itens={topCategorias("despesa")} />
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">{icon}{label}</div>
        <div className={`text-lg font-bold mt-1 ${tone ?? ""}`}>{formatBRL(value)}</div>
      </CardContent>
    </Card>
  );
}

function TopCategorias({ titulo, cor, itens }: { titulo: string; cor: string; itens: Array<{ nome: string; valor: number; pct: number }> }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent>
        {itens.length === 0 ? (
          <div className="text-sm text-muted-foreground">Sem dados no período.</div>
        ) : (
          <div className="space-y-3">
            {itens.map((it) => (
              <div key={it.nome}>
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate pr-2">{it.nome}</span>
                  <span className="font-medium tabular-nums">{formatBRL(it.valor)}</span>
                </div>
                <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${cor}`} style={{ width: `${Math.min(100, it.pct)}%` }} />
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{it.pct.toFixed(1)}% do total</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
