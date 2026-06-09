import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/useStore";
import { companyQuery, profileQuery } from "@/lib/db";

/**
 * Hook central: devolve user + profile + company carregados do Supabase.
 * Usado por todas as páginas autenticadas.
 */
export function useCurrentCompany() {
  const user = useAuthStore((s) => s.user);
  const profileQ = useQuery(profileQuery(user?.id ?? ""));
  const companyId = profileQ.data?.company_id ?? null;
  const companyQ = useQuery(companyQuery(companyId));

  return {
    user,
    profile: profileQ.data ?? null,
    company: companyQ.data ?? null,
    companyId,
    isLoading: profileQ.isLoading || companyQ.isLoading,
    needsOnboarding: !!user && profileQ.isSuccess && !companyId,
  };
}
