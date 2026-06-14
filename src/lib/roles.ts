// Roles, labels, limits and permissions matrix
export type Role = "admin" | "financeiro" | "vendas" | "estoque" | "contador";

export const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Acesso total ao sistema" },
  { value: "financeiro", label: "Financeiro", description: "Lançamentos e relatórios (limite R$ 5.000)" },
  { value: "vendas", label: "Vendas", description: "Clientes e vendas (limite R$ 1.000)" },
  { value: "estoque", label: "Estoque", description: "Produtos e estoque (limite R$ 500)" },
  { value: "contador", label: "Contador", description: "Somente leitura e exportação" },
];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  financeiro: "Financeiro",
  vendas: "Vendas",
  estoque: "Estoque",
  contador: "Contador",
};

export const ROLE_BADGE: Record<Role, string> = {
  admin: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  financeiro: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  vendas: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  estoque: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  contador: "bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30",
};

export const ROLE_AVATAR_BG: Record<Role, string> = {
  admin: "bg-purple-500",
  financeiro: "bg-blue-500",
  vendas: "bg-green-500",
  estoque: "bg-yellow-500",
  contador: "bg-gray-500",
};

export const ROLE_LIMIT: Record<Role, number | null> = {
  admin: null,
  financeiro: 5000,
  vendas: 1000,
  estoque: 500,
  contador: 0,
};

export function roleLimitLabel(role: Role): string {
  if (role === "admin") return "Sem limite";
  if (role === "contador") return "Somente leitura";
  const v = ROLE_LIMIT[role] ?? 0;
  return `Até ${v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`;
}

export type UserStatus = "ativo" | "inativo" | "convite_pendente";

export const STATUS_LABEL: Record<UserStatus, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  convite_pendente: "Convite pendente",
};

export const STATUS_BADGE: Record<UserStatus, string> = {
  ativo: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  inativo: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  convite_pendente: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
};

export function initialsOf(name: string | null | undefined, email?: string | null) {
  const base = (name || email || "?").trim();
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Permissions matrix — read-only reference
export type PermVal = "yes" | "no" | "limit" | string;
export const PERMISSIONS_MATRIX: { feature: string; values: Record<Role, PermVal> }[] = [
  { feature: "Ver Dashboard", values: { admin: "yes", financeiro: "yes", vendas: "yes", estoque: "yes", contador: "yes" } },
  { feature: "Criar Lançamentos", values: { admin: "yes", financeiro: "yes", vendas: "yes", estoque: "no", contador: "no" } },
  { feature: "Aprovar Lançamentos", values: { admin: "yes", financeiro: "limit", vendas: "no", estoque: "no", contador: "no" } },
  { feature: "Importar Extrato", values: { admin: "yes", financeiro: "yes", vendas: "no", estoque: "no", contador: "no" } },
  { feature: "Ver Relatórios", values: { admin: "yes", financeiro: "yes", vendas: "yes", estoque: "yes", contador: "yes" } },
  { feature: "Exportar Dados", values: { admin: "yes", financeiro: "yes", vendas: "no", estoque: "no", contador: "yes" } },
  { feature: "Gerenciar Usuários", values: { admin: "yes", financeiro: "no", vendas: "no", estoque: "no", contador: "no" } },
  { feature: "Configurações", values: { admin: "yes", financeiro: "no", vendas: "no", estoque: "no", contador: "no" } },
  { feature: "Ver Estoque", values: { admin: "yes", financeiro: "yes", vendas: "yes", estoque: "yes", contador: "no" } },
  { feature: "Contas Bancárias", values: { admin: "yes", financeiro: "yes", vendas: "no", estoque: "no", contador: "yes" } },
  { feature: "Aprovação (limite)", values: { admin: "∞", financeiro: "R$ 5k", vendas: "R$ 1k", estoque: "R$ 500", contador: "no" } },
];

export function formatDateTimeBR(iso: string | null | undefined): string {
  if (!iso) return "Nunca";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Nunca";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}
