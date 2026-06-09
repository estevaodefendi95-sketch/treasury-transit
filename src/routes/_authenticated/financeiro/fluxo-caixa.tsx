import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore, formatBRL } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/financeiro/fluxo-caixa")({
  head: () => ({ meta: [{ title: "Fluxo de Caixa — SuaEmpresa Gestão" }] }),
  component: FluxoPage,
});

function FluxoPage() {
  const { transacoes } = useAppStore();
  const byDay = transacoes.reduce<Record<string, { dia: string; saldo: number }>>(
    (acc, t) => {
      const dia = t.data.slice(8, 10) + "/" + t.data.slice(5, 7);
      if (!acc[dia]) acc[dia] = { dia, saldo: 0 };
      acc[dia].saldo += t.tipo === "receita" ? t.valor : -t.valor;
      return acc;
    },
    {}
  );
  const data = Object.values(byDay).sort((a, b) => a.dia.localeCompare(b.dia));
  // saldo acumulado
  let acc = 0;
  const acumulado = data.map((d) => ({ dia: d.dia, saldo: (acc += d.saldo) }));

  return (
    <>
      <PageHeader title="Fluxo de Caixa" description="Evolução do saldo ao longo do período." />
      <Card>
        <CardHeader><CardTitle className="text-base">Saldo acumulado</CardTitle></CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={acumulado}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dia" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `R$${v / 1000}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
                <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Saldo" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
