import type { Transaction } from "./db";
import { todayISO } from "./db";

export type ProjectionPoint = {
  date: string;
  dia: string;
  confirmado: number;
  projetado: number;
};

export type ProjectionSummary = {
  currentBalance: number;
  scheduledReceivables: number;
  scheduledPayables: number;
  overdueReceivables: number;
  projectedBalance: number;
  confirmedBalance: number;
  daysToNegative: number | null;
  points: ProjectionPoint[];
};

const PAID = new Set(["paid", "received"]);
const DEAD = new Set(["paid", "received", "canceled"]);

function dayLabel(iso: string) {
  return iso.slice(8, 10) + "/" + iso.slice(5, 7);
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function computeProjection(
  transactions: Transaction[],
  days: number,
  options?: { advanceReceivables?: number }, // amount to bring forward to today
): ProjectionSummary {
  const today = todayISO();
  const horizon = addDays(today, days);

  // Current balance: net of already settled
  const currentBalance = transactions.reduce((s, t) => {
    if (!PAID.has(String(t.status))) return s;
    return s + (t.type === "income" ? Number(t.amount) : -Number(t.amount));
  }, 0);

  // Overdue receivables (income, not settled, past due)
  const overdueReceivables = transactions
    .filter(
      (t) =>
        t.type === "income" &&
        !DEAD.has(String(t.status)) &&
        t.due_date < today,
    )
    .reduce((s, t) => s + Number(t.amount), 0);

  // Scheduled (within horizon, not settled)
  const upcoming = transactions.filter(
    (t) =>
      !DEAD.has(String(t.status)) &&
      t.due_date >= today &&
      t.due_date <= horizon,
  );
  const scheduledReceivables = upcoming
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const scheduledPayables = upcoming
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  // Daily buckets
  const points: ProjectionPoint[] = [];
  let conf = currentBalance;
  let proj = currentBalance + overdueReceivables; // assume overdue land today in projected

  // Simulator: anticipate receivables to today (shift from confirmed line)
  const advance = Math.max(0, options?.advanceReceivables ?? 0);
  if (advance > 0) {
    conf += advance;
    proj += advance;
  }

  // Build maps per day
  const byDayConf: Record<string, number> = {};
  const byDayProj: Record<string, number> = {};
  // Track advance debt to subtract later: we don't know which exact future receivables,
  // so subtract proportionally from upcoming income across horizon
  const futureIncome = upcoming.filter((t) => t.type === "income");
  const totalFutureIncome = futureIncome.reduce((s, t) => s + Number(t.amount), 0);
  const advanceFactor =
    advance > 0 && totalFutureIncome > 0
      ? Math.min(1, advance / totalFutureIncome)
      : 0;

  for (const t of upcoming) {
    const day = t.due_date;
    const amt = Number(t.amount);
    const signed = t.type === "income" ? amt : -amt;
    const isApproved =
      !t.approval_status || t.approval_status === "aprovado";
    // adjusted amount if we anticipated proportionally
    const adjSigned =
      t.type === "income" && advanceFactor > 0
        ? signed * (1 - advanceFactor)
        : signed;
    if (isApproved) {
      byDayConf[day] = (byDayConf[day] ?? 0) + adjSigned;
    }
    byDayProj[day] = (byDayProj[day] ?? 0) + adjSigned;
  }

  for (let i = 0; i <= days; i++) {
    const date = addDays(today, i);
    conf += byDayConf[date] ?? 0;
    proj += byDayProj[date] ?? 0;
    points.push({
      date,
      dia: dayLabel(date),
      confirmado: Math.round(conf * 100) / 100,
      projetado: Math.round(proj * 100) / 100,
    });
  }

  const negativePoint = points.find((p) => p.projetado < 0);
  const daysToNegative = negativePoint
    ? Math.round(
        (new Date(negativePoint.date).getTime() -
          new Date(today).getTime()) /
          86_400_000,
      )
    : null;

  return {
    currentBalance,
    scheduledReceivables,
    scheduledPayables,
    overdueReceivables,
    projectedBalance: points[points.length - 1]?.projetado ?? currentBalance,
    confirmedBalance: points[points.length - 1]?.confirmado ?? currentBalance,
    daysToNegative,
    points,
  };
}

// Monthly breakeven: avg recurring/fixed monthly expense over last 90 days
export function computeBreakeven(transactions: Transaction[]): number {
  const cutoff = addDays(todayISO(), -90);
  const recentExpense = transactions
    .filter(
      (t) =>
        t.type === "expense" &&
        (t.payment_date ?? t.due_date) >= cutoff &&
        (t.payment_date ?? t.due_date) <= todayISO(),
    )
    .reduce((s, t) => s + Number(t.amount), 0);
  return recentExpense / 3; // monthly average over last 3 months
}
