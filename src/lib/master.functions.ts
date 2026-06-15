import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSuperAdmin } from "./supabase-admin.server";

// ============================================================================
// Server functions do painel Super Admin (/master).
// Todas exigem o access_token do usuário e verificam Super Admin no servidor.
// O service-role client ignora RLS — por isso a verificação é obrigatória.
// ============================================================================

const Token = z.object({ token: z.string().min(1) });

export type MasterCompany = {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  segment: string | null;
  plan: string | null;
  status: string | null;
  logo_url: string | null;
  created_at: string | null;
  admin_name: string | null;
  admin_email: string | null;
  users_count: number;
};

export type MasterStats = {
  total: number;
  ativas: number;
  trial: number;
  suspensas: number;
};

// ---------- Sou Super Admin? (gating de UI/rota — não lança) ----------
export const amISuperAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) => Token.parse(d))
  .handler(async ({ data }) => {
    try {
      await requireSuperAdmin(data.token);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

// ---------- Listar empresas + admin + contagem ----------
export const listCompanies = createServerFn({ method: "POST" })
  .validator((d: unknown) => Token.parse(d))
  .handler(async ({ data }): Promise<MasterCompany[]> => {
    const { admin } = await requireSuperAdmin(data.token);
    const { data: companies, error } = await admin
      .from("companies")
      .select("id, name, cnpj, email, phone, segment, plan, status, logo_url, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, company_id, full_name, email, role");

    const byCompany = new Map<string, { count: number; adminName: string | null; adminEmail: string | null }>();
    for (const p of profiles ?? []) {
      const cid = (p as { company_id: string | null }).company_id;
      if (!cid) continue;
      const entry = byCompany.get(cid) ?? { count: 0, adminName: null, adminEmail: null };
      entry.count += 1;
      if ((p as { role: string | null }).role === "admin" && !entry.adminEmail) {
        entry.adminName = (p as { full_name: string | null }).full_name;
        entry.adminEmail = (p as { email: string | null }).email;
      }
      byCompany.set(cid, entry);
    }

    return (companies ?? []).map((c) => {
      const agg = byCompany.get(c.id) ?? { count: 0, adminName: null, adminEmail: null };
      return {
        ...c,
        admin_name: agg.adminName,
        admin_email: agg.adminEmail,
        users_count: agg.count,
      } as MasterCompany;
    });
  });

// ---------- Estatísticas resumo ----------
export const masterStats = createServerFn({ method: "POST" })
  .validator((d: unknown) => Token.parse(d))
  .handler(async ({ data }): Promise<MasterStats> => {
    const { admin } = await requireSuperAdmin(data.token);
    const { data: rows, error } = await admin.from("companies").select("status");
    if (error) throw error;
    const list = rows ?? [];
    return {
      total: list.length,
      ativas: list.filter((r) => (r as { status: string | null }).status === "ativa").length,
      trial: list.filter((r) => (r as { status: string | null }).status === "trial").length,
      suspensas: list.filter((r) => (r as { status: string | null }).status === "suspensa").length,
    };
  });

// ---------- Criar empresa + convidar admin ----------
const CreateCompany = Token.extend({
  name: z.string().min(1),
  cnpj: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  segment: z.string().optional(),
  plan: z.string().optional(),
  admin_name: z.string().min(1),
  admin_email: z.string().email(),
});

export const createCompanyWithAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) => CreateCompany.parse(d))
  .handler(async ({ data }) => {
    const { admin } = await requireSuperAdmin(data.token);
    const companyId = crypto.randomUUID();

    const { error: e1 } = await admin.from("companies").insert({
      id: companyId,
      name: data.name,
      cnpj: data.cnpj || null,
      email: data.email || null,
      phone: data.phone || null,
      segment: data.segment || null,
      plan: data.plan || "free",
      status: "trial",
    });
    if (e1) throw e1;

    // Convida o admin via Supabase Auth (cria o usuário e dispara o e-mail)
    const { data: invited, error: e2 } = await admin.auth.admin.inviteUserByEmail(
      data.admin_email,
    );
    if (e2) throw e2;
    const userId = invited.user?.id;
    if (!userId) throw new Error("Falha ao criar usuário admin.");

    const { error: e3 } = await admin.from("profiles").upsert(
      {
        id: userId,
        company_id: companyId,
        full_name: data.admin_name,
        email: data.admin_email.toLowerCase(),
        role: "admin",
        status: "convite_pendente",
      },
      { onConflict: "id" },
    );
    if (e3) throw e3;

    return { companyId, adminEmail: data.admin_email };
  });

// ---------- Detalhe de empresa (info + usuários + stats) ----------
const ById = Token.extend({ id: z.string().min(1) });

export const getCompanyDetail = createServerFn({ method: "POST" })
  .validator((d: unknown) => ById.parse(d))
  .handler(async ({ data }) => {
    const { admin } = await requireSuperAdmin(data.token);
    const { data: company, error } = await admin
      .from("companies")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;

    const { data: users } = await admin
      .from("profiles")
      .select("id, full_name, email, role, status, last_seen_at, avatar_url")
      .eq("company_id", data.id)
      .order("full_name", { ascending: true });

    const { count: txCount } = await admin
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("company_id", data.id);

    return {
      company,
      users: users ?? [],
      stats: { usersCount: (users ?? []).length, transactionsCount: txCount ?? 0 },
    };
  });

// ---------- Atualizar empresa (info / white label) ----------
const UpdateCompany = ById.extend({
  fields: z.object({
    name: z.string().optional(),
    cnpj: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    segment: z.string().nullable().optional(),
    plan: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    logo_url: z.string().nullable().optional(),
  }),
});

export const updateCompany = createServerFn({ method: "POST" })
  .validator((d: unknown) => UpdateCompany.parse(d))
  .handler(async ({ data }) => {
    const { admin } = await requireSuperAdmin(data.token);
    const { error } = await admin.from("companies").update(data.fields).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Convidar usuário para uma empresa ----------
const InviteUser = ById.extend({
  full_name: z.string().min(1),
  email: z.string().email(),
  role: z.string().min(1),
});

export const inviteCompanyUser = createServerFn({ method: "POST" })
  .validator((d: unknown) => InviteUser.parse(d))
  .handler(async ({ data }) => {
    const { admin } = await requireSuperAdmin(data.token);
    const { data: invited, error: e1 } = await admin.auth.admin.inviteUserByEmail(data.email);
    if (e1) throw e1;
    const userId = invited.user?.id;
    if (!userId) throw new Error("Falha ao criar usuário.");
    const { error: e2 } = await admin.from("profiles").upsert(
      {
        id: userId,
        company_id: data.id,
        full_name: data.full_name,
        email: data.email.toLowerCase(),
        role: data.role,
        status: "convite_pendente",
      },
      { onConflict: "id" },
    );
    if (e2) throw e2;
    return { ok: true };
  });

// ---------- Convites pendentes (todas as empresas) ----------
export const listPendingInvites = createServerFn({ method: "POST" })
  .validator((d: unknown) => Token.parse(d))
  .handler(async ({ data }) => {
    const { admin } = await requireSuperAdmin(data.token);
    const { data: invites, error } = await admin
      .from("profiles")
      .select("id, full_name, email, role, company_id, created_at")
      .eq("status", "convite_pendente")
      .order("created_at", { ascending: false });
    if (error) throw error;

    const ids = [...new Set((invites ?? []).map((i) => (i as { company_id: string | null }).company_id).filter(Boolean))];
    const { data: companies } = ids.length
      ? await admin.from("companies").select("id, name").in("id", ids as string[])
      : { data: [] };
    const nameById = new Map((companies ?? []).map((c) => [c.id, c.name as string]));

    return (invites ?? []).map((i) => ({
      ...i,
      company_name: nameById.get((i as { company_id: string }).company_id) ?? "—",
    }));
  });

// ---------- Reenviar convite ----------
const InviteId = Token.extend({ email: z.string().email() });
export const resendInvite = createServerFn({ method: "POST" })
  .validator((d: unknown) => InviteId.parse(d))
  .handler(async ({ data }) => {
    const { admin } = await requireSuperAdmin(data.token);
    const { error } = await admin.auth.admin.inviteUserByEmail(data.email);
    if (error) throw error;
    return { ok: true };
  });

// ---------- Cancelar convite (remove profile pendente) ----------
const CancelInvite = Token.extend({ profileId: z.string().min(1) });
export const cancelInvite = createServerFn({ method: "POST" })
  .validator((d: unknown) => CancelInvite.parse(d))
  .handler(async ({ data }) => {
    const { admin } = await requireSuperAdmin(data.token);
    const { error } = await admin
      .from("profiles")
      .delete()
      .eq("id", data.profileId)
      .eq("status", "convite_pendente");
    if (error) throw error;
    return { ok: true };
  });
