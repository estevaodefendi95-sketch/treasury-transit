// Helpers e tipos client-side do painel Super Admin (sem segredos).
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { amISuperAdmin } from "./master.functions";

export async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export const PLAN_OPTIONS = [
  { value: "free", label: "Gratuito" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];

export const PLAN_LABEL: Record<string, string> = {
  free: "Gratuito",
  pro: "Pro",
  enterprise: "Enterprise",
};

export const PLAN_BADGE: Record<string, string> = {
  free: "bg-gray-500/15 text-gray-700 dark:text-gray-300 border-gray-500/30",
  pro: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  enterprise: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
};

export type CompanyStatus = "ativa" | "trial" | "suspensa";

export const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  trial: "Trial",
  suspensa: "Suspensa",
};

export const STATUS_BADGE: Record<string, string> = {
  ativa: "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30",
  trial: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  suspensa: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
};

export const SEGMENT_OPTIONS = [
  "Comércio",
  "Serviços",
  "Indústria",
  "Tecnologia",
  "Saúde",
  "Educação",
  "Alimentação",
  "Construção",
  "Agronegócio",
  "Outro",
];

export function formatCompanyDateBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

/** Hook: o usuário atual é Super Admin? Usado para liberar UI e rotas /master. */
export function useSuperAdmin() {
  const check = useServerFn(amISuperAdmin);
  const q = useQuery({
    queryKey: ["amISuperAdmin"],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return false;
      const res = await check({ data: { token } });
      return res.ok;
    },
    staleTime: 5 * 60_000,
  });
  return { isSuperAdmin: q.data ?? false, isLoading: q.isLoading };
}
