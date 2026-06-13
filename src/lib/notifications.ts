// Auto-generation of notifications based on transactions, accounts, budgets.
import { supabase } from "@/integrations/supabase/client";
import type { Transaction, BankAccount, Category, NotificationType } from "./db";
import { formatBRL, todayISO } from "./db";

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type NotifInput = {
  company_id: string;
  user_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link_url?: string | null;
  dedupe_key: string; // used to avoid creating same notif twice the same day
};

async function insertIfNotExists(input: NotifInput) {
  // Dedupe: check today's notifications for same type+title+company.
  const today = todayISO();
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("company_id", input.company_id)
    .eq("type", input.type)
    .ilike("title", input.title)
    .gte("created_at", today)
    .limit(1);
  if (existing && existing.length > 0) return;
  await supabase.from("notifications").insert({
    company_id: input.company_id,
    user_id: input.user_id ?? null,
    type: input.type,
    title: input.title,
    message: input.message,
    link_url: input.link_url ?? null,
    is_read: false,
  });
}

export async function generateDueDateNotifications(
  companyId: string,
  userId: string | null,
  transactions: Transaction[],
  prefs: Record<string, boolean>,
) {
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const in3 = addDays(today, 3);

  const pending = transactions.filter(
    (t) =>
      !t.payment_date &&
      t.status !== "pago" &&
      t.status !== "recebido" &&
      t.status !== "cancelado",
  );

  const buckets: Array<{
    type: NotificationType;
    list: Transaction[];
    label: string;
  }> = [
    { type: "vencimento_hoje", list: pending.filter((t) => t.due_date === today), label: "vence hoje" },
    { type: "vencimento_amanha", list: pending.filter((t) => t.due_date === tomorrow), label: "vence amanhã" },
    { type: "vencimento_3dias", list: pending.filter((t) => t.due_date === in3), label: "vence em 3 dias" },
  ];

  for (const b of buckets) {
    if (!prefs[b.type]) continue;
    for (const tx of b.list) {
      const target = tx.type === "receita" ? "/financeiro/contas-receber" : "/financeiro/contas-pagar";
      await insertIfNotExists({
        company_id: companyId,
        user_id: userId,
        type: b.type,
        title: `Lançamento ${b.label}: ${tx.description}`,
        message: `${formatBRL(Number(tx.amount))} — venc. ${tx.due_date}`,
        link_url: target,
        dedupe_key: `${b.type}:${tx.id}`,
      });
    }
  }
}

export async function generateBalanceNotifications(
  companyId: string,
  userId: string | null,
  accounts: BankAccount[],
  prefs: Record<string, boolean>,
) {
  if (!prefs.saldo_minimo) return;
  for (const a of accounts) {
    if (!a.is_active) continue;
    const min = a.minimum_balance ?? 0;
    const bal = a.balance ?? 0;
    if (min > 0 && bal < min) {
      await insertIfNotExists({
        company_id: companyId,
        user_id: userId,
        type: "saldo_minimo",
        title: `Conta ${a.name} abaixo do saldo mínimo`,
        message: `Saldo atual ${formatBRL(bal)} (mínimo ${formatBRL(min)})`,
        link_url: "/financeiro/contas-bancarias",
        dedupe_key: `saldo_minimo:${a.id}`,
      });
    }
  }
}

export async function generateBudgetNotifications(
  companyId: string,
  userId: string | null,
  transactions: Transaction[],
  categories: Category[],
  prefs: Record<string, boolean>,
) {
  if (!prefs.orcamento_estourado) return;
  const monthStart = todayISO().slice(0, 7) + "-01";
  for (const c of categories) {
    if (!c.monthly_budget || c.monthly_budget <= 0) continue;
    const spent = transactions
      .filter(
        (t) =>
          t.category_id === c.id &&
          t.type === "despesa" &&
          (t.payment_date ?? t.due_date) >= monthStart,
      )
      .reduce((s, t) => s + Number(t.amount), 0);
    if (spent > c.monthly_budget) {
      await insertIfNotExists({
        company_id: companyId,
        user_id: userId,
        type: "orcamento_estourado",
        title: `Categoria ${c.name} ultrapassou o orçamento`,
        message: `Gasto ${formatBRL(spent)} de ${formatBRL(c.monthly_budget)}`,
        link_url: "/financeiro/categorias",
        dedupe_key: `orcamento_estourado:${c.id}:${monthStart}`,
      });
    }
  }
}

export async function runAllNotificationChecks(args: {
  companyId: string;
  userId: string | null;
  transactions: Transaction[];
  accounts: BankAccount[];
  categories: Category[];
  prefs: Record<string, boolean>;
}) {
  try {
    await generateDueDateNotifications(args.companyId, args.userId, args.transactions, args.prefs);
    await generateBalanceNotifications(args.companyId, args.userId, args.accounts, args.prefs);
    await generateBudgetNotifications(
      args.companyId,
      args.userId,
      args.transactions,
      args.categories,
      args.prefs,
    );
  } catch (e) {
    console.error("notification generation failed", e);
  }
}
