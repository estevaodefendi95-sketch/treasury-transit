// ============================================================================
// Camada de dados — Supabase real
// Tipos e helpers de query alinhados com o schema fornecido pelo usuário.
// ============================================================================
import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";

// ---------- Tipos do banco ----------
export type Company = {
  id: string;
  name: string;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  logo_url?: string | null;
};

export type Profile = {
  id: string;
  company_id: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  avatar_url: string | null;
};

export type TxType = "income" | "expense";
export type TxStatus = "pending" | "paid" | "received" | "overdue" | "canceled" | "scheduled";

export type Transaction = {
  id: string;
  company_id: string;
  type: TxType | string;
  status: TxStatus | string | null;
  description: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  account_id: string | null;
  bank_account_id: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  category_id: string | null;
  cost_center_id: string | null;
  credit_card_id: string | null;
  payment_method: string | null;
  recurrence: string | null;
  notes: string | null;
  attachment_url: string | null;
  installment_number: number | null;
  total_installments: number | null;
  recurrence_group_id: string | null;
  approval_status: string | null;
  is_reconciled: boolean | null;
  original_description?: string | null;
  edited_description?: string | null;
  category_auto_applied?: boolean | null;
  bank_statement_import_id?: string | null;
  created_at?: string;
};

export type Customer = {
  id: string;
  company_id: string;
  name: string;
  type?: string | null;
  cpf_cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  is_active?: boolean | null;
};

export type Supplier = Customer; // mesma estrutura

export type Product = {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  type: string | null;
  category: string | null;
  unit: string | null;
  sale_price: number | null;
  cost_price: number | null;
  stock_quantity: number | null;
  min_stock: number | null;
  is_active: boolean | null;
};

export type Category = {
  id: string;
  company_id: string | null;
  name: string;
  type: string | null;
  color: string | null;
  icon: string | null;
  parent_id: string | null;
  monthly_budget: number | null;
  is_active: boolean | null;
};

export type BankAccount = {
  id: string;
  company_id: string;
  name: string;
  bank_name: string | null;
  agency: string | null;
  account_number: string | null;
  balance: number | null;
  is_active: boolean | null;
};

export type SalesOrder = {
  id: string;
  company_id: string;
  order_number: number;
  customer_id: string | null;
  status: string | null;
  issue_date: string | null;
  delivery_date: string | null;
  subtotal: number | null;
  discount: number | null;
  total: number | null;
  payment_method: string | null;
  notes: string | null;
};

export type SalesOrderItem = {
  id: string;
  sales_order_id: string;
  product_id: string | null;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount: number | null;
  total: number;
};

export type BankStatement = {
  id: string;
  company_id: string;
  bank_account_id: string;
  date: string;
  description: string | null;
  amount: number;
  type: string | null;
  is_reconciled: boolean | null;
  transaction_id: string | null;
};

// ---------- Profile / Company ----------
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function fetchCompany(companyId: string): Promise<Company | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data as Company | null;
}

export async function createCompanyAndLink(input: {
  userId: string;
  email: string;
  fullName: string;
  name: string;
  cnpj?: string;
}): Promise<Company> {
  const companyId = crypto.randomUUID();
  const company: Company = {
    id: companyId,
    name: input.name,
    cnpj: input.cnpj || null,
    email: input.email,
  };

  // 1) cria empresa sem RETURNING: a policy de SELECT depende do profile,
  // que só é vinculado no passo seguinte.
  const { error: e1 } = await supabase
    .from("companies")
    .insert(company);
  if (e1) throw e1;

  // 2) upsert profile (linka usuário à empresa)
  const { error: e2 } = await supabase.from("profiles").upsert(
    {
      id: input.userId,
      company_id: companyId,
      full_name: input.fullName,
      email: input.email,
    },
    { onConflict: "id" },
  );
  if (e2) throw e2;

  // 3) semeia categorias padrão
  await seedDefaultCategories(companyId);

  return company;
}

// ---------- Categorias padrão (semeadas no onboarding) ----------
export const DEFAULT_CATEGORIES: Array<{ name: string; type: "income" | "expense"; color: string; icon: string }> = [
  // DESPESAS
  { name: "Fornecedores", type: "expense", color: "#ef4444", icon: "📦" },
  { name: "Folha de Pagamento", type: "expense", color: "#f97316", icon: "💼" },
  { name: "Aluguel", type: "expense", color: "#eab308", icon: "🏢" },
  { name: "Energia Elétrica", type: "expense", color: "#facc15", icon: "💡" },
  { name: "Internet", type: "expense", color: "#06b6d4", icon: "🌐" },
  { name: "Marketing", type: "expense", color: "#a855f7", icon: "📣" },
  { name: "Impostos", type: "expense", color: "#dc2626", icon: "🧾" },
  { name: "Manutenção", type: "expense", color: "#64748b", icon: "🔧" },
  { name: "Alimentação", type: "expense", color: "#84cc16", icon: "🍽️" },
  { name: "Transporte", type: "expense", color: "#0ea5e9", icon: "🚗" },
  // RECEITAS
  { name: "Vendas de Produtos", type: "income", color: "#10b981", icon: "🛒" },
  { name: "Prestação de Serviços", type: "income", color: "#22c55e", icon: "🛠️" },
  { name: "Juros e Rendimentos", type: "income", color: "#14b8a6", icon: "📈" },
  { name: "Outras Receitas", type: "income", color: "#16a34a", icon: "💰" },
];

export async function seedDefaultCategories(companyId: string): Promise<void> {
  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .eq("company_id", companyId)
    .limit(1);
  if (existing && existing.length > 0) return;
  const rows = DEFAULT_CATEGORIES.map((c) => ({
    company_id: companyId,
    name: c.name,
    type: c.type,
    color: c.color,
    icon: c.icon,
    is_active: true,
  }));
  const { error } = await supabase.from("categories").insert(rows);
  if (error) throw error;
}

// ---------- Query options (TanStack Query) ----------
export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId),
    enabled: !!userId,
  });

export const companyQuery = (companyId: string | null | undefined) =>
  queryOptions({
    queryKey: ["company", companyId],
    queryFn: () => (companyId ? fetchCompany(companyId) : Promise.resolve(null)),
    enabled: !!companyId,
  });

// ---------- Genéricos por empresa ----------
function listByCompany<T>(table: string) {
  return async (companyId: string): Promise<T[]> => {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as T[];
  };
}

export const fetchTransactions = listByCompany<Transaction>("transactions");
export const fetchCustomers = listByCompany<Customer>("customers");
export const fetchSuppliers = listByCompany<Supplier>("suppliers");
export const fetchProducts = listByCompany<Product>("products");
export const fetchCategories = listByCompany<Category>("categories");
export const fetchBankAccounts = listByCompany<BankAccount>("bank_accounts");
export const fetchSalesOrders = listByCompany<SalesOrder>("sales_orders");
export const fetchBankStatements = listByCompany<BankStatement>("bank_statements");

export const transactionsQuery = (companyId: string | null | undefined) =>
  queryOptions({
    queryKey: ["transactions", companyId],
    queryFn: () => (companyId ? fetchTransactions(companyId) : Promise.resolve([])),
    enabled: !!companyId,
  });

export const customersQuery = (companyId: string | null | undefined) =>
  queryOptions({
    queryKey: ["customers", companyId],
    queryFn: () => (companyId ? fetchCustomers(companyId) : Promise.resolve([])),
    enabled: !!companyId,
  });

export const suppliersQuery = (companyId: string | null | undefined) =>
  queryOptions({
    queryKey: ["suppliers", companyId],
    queryFn: () => (companyId ? fetchSuppliers(companyId) : Promise.resolve([])),
    enabled: !!companyId,
  });

export const productsQuery = (companyId: string | null | undefined) =>
  queryOptions({
    queryKey: ["products", companyId],
    queryFn: () => (companyId ? fetchProducts(companyId) : Promise.resolve([])),
    enabled: !!companyId,
  });

export const categoriesQuery = (companyId: string | null | undefined) =>
  queryOptions({
    queryKey: ["categories", companyId],
    queryFn: () => (companyId ? fetchCategories(companyId) : Promise.resolve([])),
    enabled: !!companyId,
  });

export const bankAccountsQuery = (companyId: string | null | undefined) =>
  queryOptions({
    queryKey: ["bank_accounts", companyId],
    queryFn: () => (companyId ? fetchBankAccounts(companyId) : Promise.resolve([])),
    enabled: !!companyId,
  });

export const salesOrdersQuery = (companyId: string | null | undefined) =>
  queryOptions({
    queryKey: ["sales_orders", companyId],
    queryFn: () => (companyId ? fetchSalesOrders(companyId) : Promise.resolve([])),
    enabled: !!companyId,
  });

export const bankStatementsQuery = (companyId: string | null | undefined) =>
  queryOptions({
    queryKey: ["bank_statements", companyId],
    queryFn: () => (companyId ? fetchBankStatements(companyId) : Promise.resolve([])),
    enabled: !!companyId,
  });

// ---------- Mutations utilitárias ----------
export async function insertRow<T extends Record<string, unknown>>(
  table: string,
  values: T,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.from(table).insert(values as any).select().single();
  if (error) throw error;
  return data as T;
}

export async function updateRow<T extends Record<string, unknown>>(
  table: string,
  id: string,
  values: Partial<T>,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.from(table).update(values as any).eq("id", id).select().single();
  if (error) throw error;
  return data as T;
}


export async function deleteRow(table: string, id: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

// ---------- Formatadores ----------
export const formatBRL = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatDateBR = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const isOverdue = (tx: Transaction): boolean => {
  if (tx.payment_date) return false;
  if (tx.status === "paid" || tx.status === "received" || tx.status === "canceled") return false;
  return tx.due_date < todayISO();
};

export const statusLabel = (s: string | null | undefined): string => {
  switch (s) {
    case "paid":
      return "Pago";
    case "received":
      return "Recebido";
    case "pending":
      return "Pendente";
    case "scheduled":
      return "Agendado";
    case "overdue":
      return "Atrasado";
    case "canceled":
      return "Cancelado";
    default:
      return s ?? "—";
  }
};

// ---------- Tipos extras Fase 2 ----------
export type CategoryRule = {
  id: string;
  company_id: string | null;
  pattern: string;
  category_id: string | null;
  times_applied: number | null;
  last_applied: string | null;
  created_at?: string;
};

export type NameRule = {
  id: string;
  company_id: string | null;
  original_pattern: string;
  suggested_name: string;
  times_applied: number | null;
  created_at?: string;
};

export type BankStatementImport = {
  id: string;
  company_id: string | null;
  bank_account_id: string | null;
  filename: string | null;
  import_type: string | null;
  total_transactions: number | null;
  matched_transactions: number | null;
  status: string | null;
  imported_at: string | null;
};

export const fetchCategoryRules = listByCompany<CategoryRule>("category_rules");
export const fetchNameRules = listByCompany<NameRule>("name_rules");

export const categoryRulesQuery = (companyId: string | null | undefined) =>
  queryOptions({
    queryKey: ["category_rules", companyId],
    queryFn: () => (companyId ? fetchCategoryRules(companyId) : Promise.resolve([])),
    enabled: !!companyId,
  });

export const nameRulesQuery = (companyId: string | null | undefined) =>
  queryOptions({
    queryKey: ["name_rules", companyId],
    queryFn: () => (companyId ? fetchNameRules(companyId) : Promise.resolve([])),
    enabled: !!companyId,
  });

export function applyNameRules(description: string, rules: NameRule[]): { name: string; matched: NameRule | null } {
  const lower = description.toLowerCase();
  for (const r of rules) {
    if (lower.includes(r.original_pattern.toLowerCase())) {
      return { name: r.suggested_name, matched: r };
    }
  }
  return { name: description, matched: null };
}

