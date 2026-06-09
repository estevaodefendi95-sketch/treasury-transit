import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  transactionsQuery,
  bankAccountsQuery,
  categoriesQuery,
  DEFAULT_NOTIFICATION_PREFS,
} from "@/lib/db";
import { runAllNotificationChecks } from "@/lib/notifications";

// Runs notification checks once per session per company.
export function useNotificationGenerator() {
  const { companyId, user, profile } = useCurrentCompany();
  const { data: transactions = [] } = useQuery(transactionsQuery(companyId));
  const { data: accounts = [] } = useQuery(bankAccountsQuery(companyId));
  const { data: categories = [] } = useQuery(categoriesQuery(companyId));
  const qc = useQueryClient();
  const ran = useRef<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    if (transactions.length === 0 && accounts.length === 0) return;
    const key = `notif-gen:${companyId}:${new Date().toISOString().slice(0, 10)}`;
    if (ran.current === key) return;
    if (typeof window !== "undefined" && window.sessionStorage.getItem(key)) {
      ran.current = key;
      return;
    }
    ran.current = key;
    const prefs = {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(profile?.notification_preferences ?? {}),
    };
    runAllNotificationChecks({
      companyId,
      userId: user?.id ?? null,
      transactions,
      accounts,
      categories,
      prefs,
    }).then(() => {
      try { window.sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
      qc.invalidateQueries({ queryKey: ["notifications", companyId] });
    });
  }, [companyId, transactions, accounts, categories, profile, user, qc]);
}
