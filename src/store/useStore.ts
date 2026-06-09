import { create } from "zustand";
import { persist } from "zustand/middleware";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

// ============================================================
// Types
// ============================================================
export interface User {
  id: string;
  email: string;
  nome: string;
  companyId?: string;
}

export interface Empresa {
  id: string;
  nome: string;
  cnpj?: string;
  segmento?: string;
}

export interface Transacao {
  id: string;
  data: string;
  descricao: string;
  categoria: string;
  tipo: "receita" | "despesa";
  valor: number;
  conta?: string;
  status: "pendente" | "pago" | "recebido";
}

export interface ContaPagar {
  id: string;
  fornecedor: string;
  descricao: string;
  categoria: string;
  vencimento: string;
  valor: number;
  status: "pendente" | "pago" | "atrasado";
}

export interface ContaReceber {
  id: string;
  cliente: string;
  descricao: string;
  vencimento: string;
  valor: number;
  status: "pendente" | "recebido" | "atrasado";
}

export interface Cliente {
  id: string;
  nome: string;
  email?: string;
  telefone?: string;
  documento?: string;
  cidade?: string;
}

export interface Produto {
  id: string;
  nome: string;
  sku?: string;
  preco: number;
  estoque: number;
  categoria?: string;
}

export interface Pedido {
  id: string;
  numero: string;
  cliente: string;
  data: string;
  total: number;
  status: "rascunho" | "confirmado" | "faturado" | "cancelado";
}

// ============================================================
// Auth Store
// ============================================================
interface AuthState {
  user: User | null;
  empresa: Empresa | null;
  isAuthenticated: boolean;
  onboardingComplete: boolean;
  setUser: (user: User | null) => void;
  setEmpresa: (empresa: Empresa | null) => void;
  setOnboardingComplete: (v: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      empresa: null,
      isAuthenticated: false,
      onboardingComplete: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setEmpresa: (empresa) => set({ empresa }),
      setOnboardingComplete: (v) => set({ onboardingComplete: v }),
      logout: async () => {
        if (isSupabaseConfigured) {
          await supabase.auth.signOut();
        }
        set({ user: null, empresa: null, isAuthenticated: false });
      },
    }),
    { name: "sua-empresa-auth" }
  )
);

// ============================================================
// App Data Store
// ============================================================
interface AppState {
  transacoes: Transacao[];
  contasPagar: ContaPagar[];
  contasReceber: ContaReceber[];
  clientes: Cliente[];
  produtos: Produto[];
  pedidos: Pedido[];
  loading: boolean;
  loadFromSupabase: (companyId?: string) => Promise<void>;
  // CRUD locais (otimista)
  addTransacao: (t: Transacao) => void;
  addContaPagar: (c: ContaPagar) => void;
  addContaReceber: (c: ContaReceber) => void;
  addCliente: (c: Cliente) => void;
  addProduto: (p: Produto) => void;
  addPedido: (p: Pedido) => void;
}

// Dados de exemplo para demonstrar a interface antes de conectar ao Supabase
const seedTransacoes: Transacao[] = [
  { id: "1", data: "2026-06-01", descricao: "Venda Pedido #1024", categoria: "Vendas", tipo: "receita", valor: 4850, conta: "Bradesco", status: "recebido" },
  { id: "2", data: "2026-06-02", descricao: "Pagamento Fornecedor ABC", categoria: "Fornecedores", tipo: "despesa", valor: 1280, conta: "Bradesco", status: "pago" },
  { id: "3", data: "2026-06-03", descricao: "Aluguel escritório", categoria: "Despesa Fixa", tipo: "despesa", valor: 3500, conta: "Itaú", status: "pago" },
  { id: "4", data: "2026-06-05", descricao: "Venda Pedido #1025", categoria: "Vendas", tipo: "receita", valor: 12300, conta: "Bradesco", status: "recebido" },
  { id: "5", data: "2026-06-07", descricao: "Conta de energia", categoria: "Utilidades", tipo: "despesa", valor: 890, conta: "Itaú", status: "pendente" },
];

const seedContasPagar: ContaPagar[] = [
  { id: "1", fornecedor: "Fornecedor ABC Ltda", descricao: "NF 4521", categoria: "Insumos", vencimento: "2026-06-15", valor: 4280, status: "pendente" },
  { id: "2", fornecedor: "Distribuidora XYZ", descricao: "NF 8821", categoria: "Mercadorias", vencimento: "2026-06-12", valor: 9650, status: "pendente" },
  { id: "3", fornecedor: "Energia Elétrica", descricao: "Conta 06/2026", categoria: "Utilidades", vencimento: "2026-06-08", valor: 890, status: "atrasado" },
];

const seedContasReceber: ContaReceber[] = [
  { id: "1", cliente: "Comércio Beta", descricao: "NF 1024", vencimento: "2026-06-15", valor: 4850, status: "pendente" },
  { id: "2", cliente: "Loja Alfa", descricao: "NF 1025", vencimento: "2026-06-20", valor: 12300, status: "pendente" },
  { id: "3", cliente: "Indústria Gama", descricao: "NF 1019", vencimento: "2026-06-05", valor: 7800, status: "atrasado" },
];

const seedClientes: Cliente[] = [
  { id: "1", nome: "Comércio Beta Ltda", email: "contato@beta.com.br", telefone: "(11) 3456-7890", documento: "12.345.678/0001-90", cidade: "São Paulo" },
  { id: "2", nome: "Loja Alfa Comércio", email: "vendas@alfa.com.br", telefone: "(11) 9876-5432", documento: "98.765.432/0001-10", cidade: "Campinas" },
  { id: "3", nome: "Indústria Gama S.A.", email: "compras@gama.ind.br", telefone: "(19) 3344-5566", documento: "11.222.333/0001-44", cidade: "Sorocaba" },
];

const seedProdutos: Produto[] = [
  { id: "1", nome: "Produto Premium A", sku: "PRD-A-001", preco: 250, estoque: 48, categoria: "Linha Premium" },
  { id: "2", nome: "Produto Standard B", sku: "PRD-B-002", preco: 120, estoque: 156, categoria: "Linha Standard" },
  { id: "3", nome: "Acessório C", sku: "ACC-C-003", preco: 45, estoque: 8, categoria: "Acessórios" },
];

const seedPedidos: Pedido[] = [
  { id: "1", numero: "1024", cliente: "Comércio Beta Ltda", data: "2026-06-01", total: 4850, status: "faturado" },
  { id: "2", numero: "1025", cliente: "Loja Alfa Comércio", data: "2026-06-03", total: 12300, status: "faturado" },
  { id: "3", numero: "1026", cliente: "Indústria Gama S.A.", data: "2026-06-07", total: 6240, status: "confirmado" },
  { id: "4", numero: "1027", cliente: "Comércio Beta Ltda", data: "2026-06-08", total: 1980, status: "rascunho" },
];

export const useAppStore = create<AppState>((set) => ({
  transacoes: seedTransacoes,
  contasPagar: seedContasPagar,
  contasReceber: seedContasReceber,
  clientes: seedClientes,
  produtos: seedProdutos,
  pedidos: seedPedidos,
  loading: false,
  loadFromSupabase: async (_companyId) => {
    if (!isSupabaseConfigured) return; // mantém seed data
    set({ loading: true });
    try {
      // Tenta carregar tabelas que existirem; ignora as que falharem (schema pode variar)
      const tryFetch = async <T>(table: string): Promise<T[] | null> => {
        const { data, error } = await supabase.from(table).select("*");
        if (error) return null;
        return (data as T[]) ?? [];
      };
      const [trx, cp, cr, cli, prod, ped] = await Promise.all([
        tryFetch<Transacao>("transacoes"),
        tryFetch<ContaPagar>("contas_pagar"),
        tryFetch<ContaReceber>("contas_receber"),
        tryFetch<Cliente>("clientes"),
        tryFetch<Produto>("produtos"),
        tryFetch<Pedido>("pedidos"),
      ]);
      set((s) => ({
        transacoes: trx ?? s.transacoes,
        contasPagar: cp ?? s.contasPagar,
        contasReceber: cr ?? s.contasReceber,
        clientes: cli ?? s.clientes,
        produtos: prod ?? s.produtos,
        pedidos: ped ?? s.pedidos,
      }));
    } finally {
      set({ loading: false });
    }
  },
  addTransacao: (t) => set((s) => ({ transacoes: [t, ...s.transacoes] })),
  addContaPagar: (c) => set((s) => ({ contasPagar: [c, ...s.contasPagar] })),
  addContaReceber: (c) => set((s) => ({ contasReceber: [c, ...s.contasReceber] })),
  addCliente: (c) => set((s) => ({ clientes: [c, ...s.clientes] })),
  addProduto: (p) => set((s) => ({ produtos: [p, ...s.produtos] })),
  addPedido: (p) => set((s) => ({ pedidos: [p, ...s.pedidos] })),
}));

// ============================================================
// Helpers
// ============================================================
export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const formatDateBR = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
};
