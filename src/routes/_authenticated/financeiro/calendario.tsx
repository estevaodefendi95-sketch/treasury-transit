import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore, formatBRL, formatDateBR } from "@/store/useStore";

export const Route = createFileRoute("/_authenticated/financeiro/calendario")({
  head: () => ({ meta: [{ title: "Calendário Financeiro — SuaEmpresa Gestão" }] }),
  component: () => {
    const { contasPagar, contasReceber } = useAppStore();
    const eventos = [
      ...contasPagar.map((c) => ({ id: c.id, data: c.vencimento, descricao: c.fornecedor + " · " + c.descricao, tipo: "pagar" as const, valor: c.valor })),
      ...contasReceber.map((c) => ({ id: c.id, data: c.vencimento, descricao: c.cliente + " · " + c.descricao, tipo: "receber" as const, valor: c.valor })),
    ].sort((a, b) => a.data.localeCompare(b.data));

    const grupos = eventos.reduce<Record<string, typeof eventos>>((acc, ev) => {
      (acc[ev.data] ||= []).push(ev);
      return acc;
    }, {});

    return (
      <>
        <PageHeader title="Calendário Financeiro" description="Vencimentos de contas a pagar e receber." />
        <div className="space-y-4">
          {Object.entries(grupos).map(([data, evs]) => (
            <Card key={data}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
                  <h3 className="font-semibold text-foreground">{formatDateBR(data)}</h3>
                  <span className="text-xs text-muted-foreground">{evs.length} evento(s)</span>
                </div>
                <div className="space-y-2">
                  {evs.map((ev) => (
                    <div key={ev.id + ev.tipo} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${ev.tipo === "pagar" ? "bg-rose-500" : "bg-emerald-500"}`} />
                        <span className="text-sm text-foreground">{ev.descricao}</span>
                      </div>
                      <span className={`text-sm font-semibold ${ev.tipo === "pagar" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {ev.tipo === "pagar" ? "-" : "+"} {formatBRL(ev.valor)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    );
  },
});
