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
  // 1) cria empresa
  const { data: comp, error: e1 } = await supabase
    .from("companies")
    .insert({ name: input.name, cnpj: input.cnpj || null, email: input.email })
    .select()
    .single();
  if (e1) throw e1;

  // 2) upsert profile (linka usuário à empresa)
  const { error: e2 } = await supabase.from("profiles").upsert(
    {
      id: input.userId,
      company_id: comp.id,
      full_name: input.fullName,
      email: input.email,
      role: "owner",
    },
    { onConflict: "id" },
  );
  if (e2) throw e2;

  return comp as Company;
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
