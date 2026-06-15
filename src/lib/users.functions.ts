import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InviteInput = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.enum(["admin", "financeiro", "vendas", "estoque", "contador"]),
  company_id: z.string().uuid(),
  redirect_to: z.string().url().optional(),
});

export const inviteUser = createServerFn({ method: "POST" })
  .validator((d: unknown) => InviteInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();

    // 1) Convidar via Supabase Auth Admin
    const { data: invited, error: inviteErr } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: data.full_name,
          company_id: data.company_id,
          role: data.role,
        },
        redirectTo: data.redirect_to,
      });

    let userId = invited?.user?.id ?? null;

    if (inviteErr || !userId) {
      const msg = (inviteErr?.message ?? "").toLowerCase();
      // Se já existe no Auth, recuperar o id para criar/atualizar o profile
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        // tenta achar usuário existente
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        const found = list?.users?.find(
          (u) => (u.email ?? "").toLowerCase() === email,
        );
        if (!found) {
          return { ok: false as const, error: "Usuário já cadastrado em outra empresa." };
        }
        userId = found.id;
      } else {
        return { ok: false as const, error: inviteErr?.message ?? "Falha ao enviar convite." };
      }
    }

    // 2) Criar/atualizar profile com status convite_pendente
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId!,
          company_id: data.company_id,
          email,
          full_name: data.full_name,
          role: data.role,
          status: "convite_pendente",
        },
        { onConflict: "id" },
      );

    if (profErr) {
      return { ok: false as const, error: profErr.message };
    }

    return { ok: true as const, userId: userId! };
  });
