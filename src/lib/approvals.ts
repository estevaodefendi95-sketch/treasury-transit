// ============================================================================
// Approval workflow helpers (Lote 4A)
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";

export type ApprovalRole = "admin" | "financeiro" | "vendas" | "estoque";
export type ApprovalAction = "aprovado" | "rejeitado";
export type ApprovalStatus = "aprovado" | "aguardando_aprovacao" | "rejeitado";

export type ApprovalLimit = {
  id: string;
  company_id: string;
  role: string;
  max_amount: number;
  created_at?: string;
};

export type ApprovalLog = {
  id: string;
  transaction_id: string;
  approved_by: string | null;
  action: string;
  comment: string | null;
  created_at: string;
};

export const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  financeiro: "Financeiro",
  vendas: "Vendas",
  estoque: "Estoque",
};

export const DEFAULT_LIMITS: Array<{ role: ApprovalRole; max_amount: number }> = [
  { role: "admin", max_amount: 999_999_999 },
  { role: "financeiro", max_amount: 5_000 },
  { role: "vendas", max_amount: 1_000 },
  { role: "estoque", max_amount: 500 },
];

// ---- Queries ----
export const fetchApprovalLimits = async (companyId: string): Promise<ApprovalLimit[]> => {
  const { data, error } = await supabase
    .from("approval_limits")
    .select("*")
    .eq("company_id", companyId);
  if (error) throw error;
  return (data ?? []) as ApprovalLimit[];
};

export const approvalLimitsQuery = (companyId: string | null | undefined) =>
  queryOptions({
    queryKey: ["approval_limits", companyId],
    queryFn: () => (companyId ? fetchApprovalLimits(companyId) : Promise.resolve([])),
    enabled: !!companyId,
  });

export const fetchApprovalLogs = async (transactionId: string): Promise<ApprovalLog[]> => {
  const { data, error } = await supabase
    .from("approval_logs")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ApprovalLog[];
};

export const approvalLogsQuery = (transactionId: string | null | undefined) =>
  queryOptions({
    queryKey: ["approval_logs", transactionId],
    queryFn: () => (transactionId ? fetchApprovalLogs(transactionId) : Promise.resolve([])),
    enabled: !!transactionId,
  });

// ---- Logic ----
export function getLimitForRole(limits: ApprovalLimit[], role: string | null | undefined): number {
  if (!role) return 0;
  const found = limits.find((l) => l.role === role);
  if (found) return Number(found.max_amount);
  const def = DEFAULT_LIMITS.find((d) => d.role === role);
  return def?.max_amount ?? 0;
}

/**
 * Decide approval_status for a new/edited transaction.
 * Returns "aguardando_aprovacao" if amount exceeds role limit, otherwise "aprovado".
 */
export function computeApprovalStatus(
  amount: number,
  role: string | null | undefined,
  limits: ApprovalLimit[],
): ApprovalStatus {
  const limit = getLimitForRole(limits, role);
  if (limit <= 0) return "aprovado";
  return amount > limit ? "aguardando_aprovacao" : "aprovado";
}

/**
 * After inserting a transaction that needs approval, notify all admins.
 */
export async function notifyAdminsPendingApproval(args: {
  companyId: string;
  transactionId: string;
  description: string;
  amount: number;
  requesterName: string;
}) {
  const { data: admins } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", args.companyId)
    .eq("role", "admin");
  if (!admins || admins.length === 0) return;
  const rows = admins.map((a: { id: string }) => ({
    company_id: args.companyId,
    user_id: a.id,
    type: "aprovacao_pendente",
    title: `Aprovação pendente: ${args.description}`,
    message: `${args.requesterName} solicitou aprovação de R$ ${args.amount
      .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    link_url: "/aprovacoes",
    is_read: false,
  }));
  await supabase.from("notifications").insert(rows);
}

export async function notifyRequesterApprovalDecision(args: {
  companyId: string;
  requesterId: string;
  transactionId: string;
  description: string;
  action: ApprovalAction;
  comment: string | null;
}) {
  const title =
    args.action === "aprovado"
      ? `Lançamento aprovado: ${args.description}`
      : `Lançamento rejeitado: ${args.description}`;
  await supabase.from("notifications").insert({
    company_id: args.companyId,
    user_id: args.requesterId,
    type: "aprovacao_concluida",
    title,
    message: args.comment || (args.action === "aprovado" ? "Sem comentários" : "Rejeitado"),
    link_url: "/financeiro/transacoes",
    is_read: false,
  });
}
