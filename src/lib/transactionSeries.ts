// ============================================================================
// Helpers para criar/editar/deletar séries de transações (recorrência + parcelas).
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import { buildRecurrenceDates, RECURRENCE_INTERVAL_MONTHS, type Recurrence } from "@/lib/payment";
import type { Transaction } from "@/lib/db";

type TxInsert = Partial<Transaction> & {
  company_id: string;
  type: string;
  description: string;
  amount: number;
  due_date: string;
  status: string;
};

/**
 * Cria 1+ transações na tabela:
 * - Se recurrence === "unico" e installments <= 1 → uma linha
 * - Se recurrence !== "unico" → gera datas via buildRecurrenceDates, todas com mesmo recurrence_group_id
 * - Se installments > 1 (parcelas do cartão) → gera N linhas mensais com installment_number/total_installments
 *   e mesmo recurrence_group_id, partindo de due_date inicial.
 *
 * Se ambos forem combinados, instalmentos têm prioridade sobre recurrence.
 */
export async function createTransactionSeries(
  base: TxInsert,
  opts: { recurrence: Recurrence; installments?: number },
): Promise<number> {
  const { recurrence, installments = 1 } = opts;

  // Caso de parcelas (cartão)
  if (installments > 1) {
    const groupId = crypto.randomUUID();
    const rows: TxInsert[] = [];
    let date = base.due_date;
    for (let i = 1; i <= installments; i++) {
      rows.push({
        ...base,
        due_date: date,
        installment_number: i,
        total_installments: installments,
        recurrence_group_id: groupId,
        recurrence: "mensal",
        recurrence_interval_months: 1,
      });
      // próxima parcela: +1 mês
      const [y, m, d] = date.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCMonth(dt.getUTCMonth() + 1);
      date = dt.toISOString().slice(0, 10);
    }
    const { error } = await supabase.from("transactions").insert(rows);
    if (error) throw error;
    return rows.length;
  }

  // Caso de recorrência simples
  if (recurrence !== "unico") {
    const groupId = crypto.randomUUID();
    const dates = buildRecurrenceDates(base.due_date, recurrence);
    const rows: TxInsert[] = dates.map((d) => ({
      ...base,
      due_date: d,
      recurrence_group_id: groupId,
      recurrence,
      recurrence_interval_months: RECURRENCE_INTERVAL_MONTHS[recurrence] ?? null,
    }));
    const { error } = await supabase.from("transactions").insert(rows);
    if (error) throw error;
    return rows.length;
  }

  // Único
  const { error } = await supabase.from("transactions").insert([base]);
  if (error) throw error;
  return 1;
}

/** Deleta uma transação aplicando scope (one/future/all) sobre o recurrence_group_id. */
export async function deleteWithScope(tx: Transaction, scope: "one" | "future" | "all"): Promise<number> {
  if (!tx.recurrence_group_id || scope === "one") {
    const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
    if (error) throw error;
    return 1;
  }
  if (scope === "all") {
    const { error, count } = await supabase
      .from("transactions")
      .delete({ count: "exact" })
      .eq("recurrence_group_id", tx.recurrence_group_id);
    if (error) throw error;
    return count ?? 0;
  }
  // future = este + os próximos (due_date >=)
  const { error, count } = await supabase
    .from("transactions")
    .delete({ count: "exact" })
    .eq("recurrence_group_id", tx.recurrence_group_id)
    .gte("due_date", tx.due_date);
  if (error) throw error;
  return count ?? 0;
}

/** Atualiza uma transação aplicando scope (one/future/all). */
export async function updateWithScope(
  tx: Transaction,
  scope: "one" | "future" | "all",
  patch: Partial<Transaction>,
): Promise<number> {
  if (!tx.recurrence_group_id || scope === "one") {
    const { error } = await supabase.from("transactions").update(patch).eq("id", tx.id);
    if (error) throw error;
    return 1;
  }
  if (scope === "all") {
    const { error, count } = await supabase
      .from("transactions")
      .update(patch, { count: "exact" })
      .eq("recurrence_group_id", tx.recurrence_group_id);
    if (error) throw error;
    return count ?? 0;
  }
  const { error, count } = await supabase
    .from("transactions")
    .update(patch, { count: "exact" })
    .eq("recurrence_group_id", tx.recurrence_group_id)
    .gte("due_date", tx.due_date);
  if (error) throw error;
  return count ?? 0;
}
