// Helpers para contas bancárias e cartões.
import type { BankAccount, Transaction } from "@/lib/db";

/** Mascara número de conta: **** 1234 (mostra últimos 4). */
export function maskAccountNumber(n: string | null | undefined): string {
  if (!n) return "—";
  const clean = n.replace(/\D/g, "");
  if (clean.length <= 4) return clean;
  return `**** ${clean.slice(-4)}`;
}

export function maskCardNumber(last4: string | null | undefined): string {
  if (!last4) return "•••• •••• •••• ••••";
  return `•••• •••• •••• ${last4.replace(/\D/g, "").slice(-4)}`;
}

/** Calcula saldo de uma conta: initial_balance + soma de transações pagas/recebidas. */
export function computeAccountBalance(
  account: BankAccount,
  transactions: Transaction[],
): number {
  const initial = Number(account.initial_balance ?? account.balance ?? 0);
  let delta = 0;
  for (const t of transactions) {
    if (t.bank_account_id !== account.id) continue;
    if (t.status !== "pago" && t.status !== "recebido") continue;
    const amount = Number(t.amount);
    if (t.type === "receita" || t.type === "transferencia_in") delta += amount;
    else if (t.type === "despesa" || t.type === "transferencia_out") delta -= amount;
  }
  return initial + delta;
}

/** Histórico de saldo diário nos últimos N dias. */
export function buildBalanceHistory(
  account: BankAccount,
  transactions: Transaction[],
  days = 30,
): { date: string; balance: number }[] {
  const today = new Date();
  const out: { date: string; balance: number }[] = [];
  const initial = Number(account.initial_balance ?? account.balance ?? 0);

  // Construir mapa de delta por dia
  const txs = transactions.filter(
    (t) => t.bank_account_id === account.id && (t.status === "pago" || t.status === "recebido"),
  );
  const deltaByDay = new Map<string, number>();
  for (const t of txs) {
    const d = (t.payment_date ?? t.due_date).slice(0, 10);
    const amount = Number(t.amount);
    const sign = t.type === "receita" || t.type === "transferencia_in" ? 1 : -1;
    deltaByDay.set(d, (deltaByDay.get(d) ?? 0) + sign * amount);
  }

  // Saldo acumulado até (today - days)
  let acc = initial;
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  for (const [day, delta] of deltaByDay.entries()) {
    if (day < cutoff.toISOString().slice(0, 10)) acc += delta;
  }

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    acc += deltaByDay.get(iso) ?? 0;
    out.push({ date: iso, balance: acc });
  }
  return out;
}

/** Soma gastos do cartão de crédito num ciclo de fatura. */
export function computeCardSpending(
  cardId: string,
  transactions: Transaction[],
  cycle: { startISO: string; endISO: string },
): number {
  return transactions
    .filter(
      (t) =>
        t.credit_card_id === cardId &&
        t.type === "despesa" &&
        t.due_date >= cycle.startISO &&
        t.due_date <= cycle.endISO,
    )
    .reduce((s, t) => s + Number(t.amount), 0);
}

/** Calcula ciclo de fatura: do dia closing+1 do mês anterior até dia closing do mês atual. */
export function billingCycle(closingDay: number, year: number, month: number) {
  // month: 1-12
  const pad = (n: number) => String(n).padStart(2, "0");
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  // start = prevYear-prevMonth-(closingDay+1)
  const start = new Date(Date.UTC(prevYear, prevMonth - 1, closingDay + 1));
  const end = new Date(Date.UTC(year, month - 1, closingDay));
  return {
    startISO: `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}-${pad(start.getUTCDate())}`,
    endISO: `${end.getUTCFullYear()}-${pad(end.getUTCMonth() + 1)}-${pad(end.getUTCDate())}`,
  };
}
