import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for the SuaEmpresa Gestão ERP.
 *
 * IMPORTANT: Cole abaixo a URL e a chave publishable (anon) do SEU projeto Supabase
 * existente — as mesmas usadas no projeto original do GitHub.
 *
 * Você encontra em: Supabase Dashboard → Settings → API
 *  - Project URL  → SUPABASE_URL
 *  - anon/public  → SUPABASE_PUBLISHABLE_KEY
 *
 * Essas chaves são públicas (publishable) e podem ficar no código.
 */
const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "YOUR-ANON-PUBLISHABLE-KEY";

export const isSupabaseConfigured =
  !SUPABASE_URL.includes("YOUR-PROJECT") &&
  !SUPABASE_PUBLISHABLE_KEY.includes("YOUR-ANON");

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
