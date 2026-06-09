// Store de autenticação enxuto — só sessão. Dados de domínio vão por React Query.
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  initialized: boolean;
  setUser: (u: User | null) => void;
  setInitialized: (v: boolean) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,
  setUser: (user) => set({ user }),
  setInitialized: (initialized) => set({ initialized }),
  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));

// Re-exports para compatibilidade com código antigo
export { formatBRL, formatDateBR } from "@/lib/db";
