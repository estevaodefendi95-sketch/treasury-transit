import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { transactionsQuery, formatBRL, formatDateBR, statusLabel, type Transaction } from "@/lib/db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/financeiro/calendario")({
  ssr: false,
  head: () => ({ meta: [{ title: "Calendário — SuaEmpresa Gestão" }] }),
  component: CalendarioPage,
});

type ViewMode = "realizado" | "previsto" | "ambos";

function CalendarioPage() {
  const { companyId } = useCurrentCompany();
  const { data: transacoes = [] } = useQuery(transactionsQuery(companyId));

  const [cursor, setCursor] = useState(() => new Date());
  const [mode, setMode] = useState<ViewMode>("ambos");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  // Filtra por modo
  const filtered = useMemo(() => transacoes.filter((t) => {
    const realized = !!t.payment_date;
    if (mode === "realizado") return realized;
    if (mode === "previsto") return !realized;
    return true;
  }), [transacoes, mode]);

  const byDay = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    filtered.forEach((t) => {
      const d = t.payment_date ?? t.due_date;
      if (!d) return;
      const [y, m, day] = d.split("-").map(Number);
      if (y === year && m === month + 1) {
        const key = String(day);
        (map[key] ||= []).push(t);
      }
    });
    return map;
  }, [filtered, year, month]);

  // Summary do mês
  const summary = useMemo(() => {
    let entradas = 0, saidas = 0, projEntradas = 0, projSaidas = 0;
    filtered.forEach((t) => {
      const d = t.payment_date ?? t.due_date;
      if (!d?.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)) return;
      const amount = Number(t.amount);
      const realized = !!t.payment_date;
      if (t.type === "income") {
        if (realized) entradas += amount; else projEntradas += amount;
      } else {
        if (realized) saidas += amount; else projSaidas += amount;
      }
    });
    return {
      entradas, saidas,
      saldo: entradas - saidas,
      projetado: (entradas + projEntradas) - (saidas + projSaidas),
    };
  }, [filtered, year, month]);

  const cells: Array<number | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const goPrev = () => setCursor(new Date(year, month - 1, 1));
  const goNext = () => setCursor(new Date(year, month + 1, 1));
  const goToday = () => setCursor(new Date());

  const selectedItems = selectedDay ? (byDay[selectedDay] ?? []) : [];
  const selectedDate = selectedDay ? `${year}-${String(month + 1).padStart(2, "0")}-${selectedDay.padStart(2, "0")}` : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Calendário Financeiro" description="Visão diária de receitas, despesas e saldo previsto." />

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Entradas</div><div className="text-lg font-bold text-emerald-600">{formatBRL(summary.entradas)}</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Saídas</div><div className="text-lg font-bold text-rose-600">{formatBRL(summary.saidas)}</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Saldo</div><div className={cn("text-lg font-bold", summary.saldo >= 0 ? "text-foreground" : "text-rose-600")}>{formatBRL(summary.saldo)}</div></CardContent></Card>
        <Card><CardContent className="py-3"><div className="text-xs text-muted-foreground">Projetado</div><div className={cn("text-lg font-bold", summary.projetado >= 0 ? "text-foreground" : "text-rose-600")}>{formatBRL(summary.projetado)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2">
              <Button size="icon" variant="outline" onClick={goPrev}><ChevronLeft className="h-4 w-4" /></Button>
              <CardTitle className="text-base capitalize min-w-[160px] text-center">{monthLabel}</CardTitle>
              <Button size="icon" variant="outline" onClick={goNext}><ChevronRight className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" onClick={goToday}><CalendarIcon className="h-4 w-4 mr-1" />Hoje</Button>
            </div>
            <div className="flex gap-1 border border-border rounded-md p-0.5">
              {(["realizado", "previsto", "ambos"] as ViewMode[]).map((m) => (
                <Button key={m} size="sm" variant={mode === m ? "default" : "ghost"} className="h-7 capitalize"
                  onClick={() => setMode(m)}>{m}</Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop grid */}
          <div className="hidden md:grid grid-cols-7 gap-1 text-xs">
            {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
              <div key={d} className="text-center text-muted-foreground font-medium py-1">{d}</div>
            ))}
            {cells.map((day, i) => {
              const items = day ? byDay[String(day)] || [] : [];
              const totalIn = items.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
              const totalOut = items.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
              const balance = totalIn - totalOut;
              const isToday = day !== null && isCurrentMonth && day === today.getDate();
              return (
                <button
                  key={i}
                  disabled={day === null}
                  onClick={() => day && setSelectedDay(String(day))}
                  className={cn(
                    "min-h-[88px] rounded-md border border-border p-1.5 text-[10px] text-left transition-colors",
                    day === null && "bg-muted/30 border-transparent cursor-default",
                    day !== null && "hover:bg-accent cursor-pointer",
                    isToday && "border-primary border-2",
                  )}
                >
                  {day && (
                    <>
                      <div className="font-semibold text-foreground mb-1">{day}</div>
                      {totalIn > 0 && (
                        <div className="bg-emerald-100 text-emerald-700 rounded px-1 py-0.5 truncate mb-0.5">
                          +{formatBRL(totalIn)}
                        </div>
                      )}
                      {totalOut > 0 && (
                        <div className="bg-rose-100 text-rose-700 rounded px-1 py-0.5 truncate mb-0.5">
                          -{formatBRL(totalOut)}
                        </div>
                      )}
                      {(totalIn > 0 || totalOut > 0) && (
                        <div className={cn("font-semibold mt-0.5", balance >= 0 ? "text-emerald-700" : "text-rose-700")}>
                          {balance >= 0 ? "+" : ""}{formatBRL(balance)}
                        </div>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile agenda */}
          <div className="md:hidden space-y-2">
            {Object.keys(byDay).sort((a, b) => Number(a) - Number(b)).map((day) => {
              const items = byDay[day];
              const totalIn = items.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
              const totalOut = items.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
              return (
                <button key={day} onClick={() => setSelectedDay(day)}
                  className="w-full text-left rounded-md border border-border p-3 hover:bg-accent">
                  <div className="flex justify-between items-center">
                    <div className="font-semibold">Dia {day}</div>
                    <Badge variant="outline">{items.length}</Badge>
                  </div>
                  <div className="flex gap-3 text-xs mt-1">
                    {totalIn > 0 && <span className="text-emerald-600">+{formatBRL(totalIn)}</span>}
                    {totalOut > 0 && <span className="text-rose-600">-{formatBRL(totalOut)}</span>}
                  </div>
                </button>
              );
            })}
            {Object.keys(byDay).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma transação neste mês.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Slide-over com transações do dia */}
      <Sheet open={!!selectedDay} onOpenChange={(o) => !o && setSelectedDay(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedDate ? formatDateBR(selectedDate) : ""}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {selectedItems.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma transação.</p>
            )}
            {selectedItems.map((t) => (
              <div key={t.id} className="rounded-md border border-border p-3 space-y-1">
                <div className="flex justify-between items-start gap-2">
                  <div className="font-medium text-sm">{t.description}</div>
                  <div className={cn("font-mono text-sm shrink-0", t.type === "income" ? "text-emerald-600" : "text-rose-600")}>
                    {t.type === "income" ? "+" : "-"} {formatBRL(Number(t.amount))}
                  </div>
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{statusLabel(t.status)}</Badge>
                  {t.payment_date ? <span>Pago em {formatDateBR(t.payment_date)}</span> : <span>Vence {formatDateBR(t.due_date)}</span>}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
