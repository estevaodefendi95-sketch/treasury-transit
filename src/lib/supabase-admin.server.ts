import process from "node:process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client using the SERVICE ROLE key. This bypasses RLS,
// so it MUST only ever run inside server functions and only after the caller
// has been verified as a Super Admin (see requireSuperAdmin below).
//
// The .server.ts suffix keeps this out of the client bundle. Env is read
// per-call (Cloudflare binds env at request time, not at module load).

const SUPABASE_URL = "https://jcqpuqhdfveleusjsxeo.supabase.co";

export function getAdminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY ausente — defina a variável de ambiente no servidor.",
    );
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Verifica o token JWT do chamador e garante que ele é um Super Admin
 * (e-mail presente em SUPER_ADMIN_EMAILS). Retorna o client admin pronto.
 * Lança erro caso o token seja inválido ou o usuário não seja autorizado.
 */
export async function requireSuperAdmin(accessToken: string | undefined): Promise<{
  admin: SupabaseClient;
  email: string;
  userId: string;
}> {
  if (!accessToken) throw new Error("Não autenticado.");
  const admin = getAdminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Sessão inválida.");
  const email = (data.user.email ?? "").toLowerCase();
  const allow = superAdminEmails();
  if (allow.length === 0) {
    throw new Error("SUPER_ADMIN_EMAILS não configurado no servidor.");
  }
  if (!allow.includes(email)) {
    throw new Error("Acesso restrito a Super Admins.");
  }
  return { admin, email, userId: data.user.id };
}
