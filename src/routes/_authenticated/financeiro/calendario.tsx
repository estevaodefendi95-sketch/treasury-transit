import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { transactionsQuery, formatBRL, type Transaction } from "@/lib/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financeiro/calendario")({
  ssr: false,
  head: () => ({ meta: [{ title: "Calendário — SuaEmpresa Gestão" }] }),
  component: CalendarioPage,
});

function CalendarioPage() {
  const { companyId } = useCurrentCompany();
  const { data: transacoes = [] } = useQuery(transactionsQuery(companyId));

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDay: Record<string, Transaction[]> = {};
  transacoes.forEach((t) => {
    const d = t.due_date;
    if (!d) return;
    const [y, m, day] = d.split("-").map(Number);
    if (y === year && m === month + 1) {
      const key = String(day);
      byDay[key] = byDay[key] || [];
      byDay[key].push(t);
    }
  });

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6">
      <PageHeader title="Calendário Financeiro" description={`Vencimentos de ${monthLabel}.`} />
      <Card>
        <CardHeader><CardTitle className="text-base capitalize">{monthLabel}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-xs">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="text-center text-muted-foreground font-medium py-1">{d}</div>
            ))}
            {cells.map((day, i) => {
              const items = day ? byDay[String(day)] || [] : [];
              const totalIn = items.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
              const totalOut = items.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
              return (
                <div key={i} className={cn(
                  "min-h-[80px] rounded-md border border-border p-1.5 text-[10px]",
                  day === null && "bg-muted/30 border-transparent",
                  day === now.getDate() && "border-primary border-2",
                )}>
                  {day && (
                    <>
                      <div className="font-semibold text-foreground">{day}</div>
                      {totalIn > 0 && <div className="text-emerald-600 truncate">+{formatBRL(totalIn)}</div>}
                      {totalOut > 0 && <div className="text-rose-600 truncate">-{formatBRL(totalOut)}</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
