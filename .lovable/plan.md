# Convite de Usuários via Server Function

## Sobre o `SUPABASE_SERVICE_ROLE_KEY`

Não é necessário adicioná-lo manualmente. O Lovable Cloud já provisiona essa chave e expõe um cliente admin pronto em `@/integrations/supabase/client.server` (`supabaseAdmin`). Vou reutilizá-lo.

## O que será criado

### 1. `src/lib/users.functions.ts` (novo)
Server function `inviteUser` com:
- **Middleware**: `requireSupabaseAuth` — exige usuário autenticado
- **Validação (zod)**: `email`, `full_name`, `role` (enum dos 5 papéis), `company_id` (uuid)
- **Autorização**: verifica que o chamador é `admin` da mesma `company_id` (consulta `profiles` via cliente autenticado)
- **Lógica**:
  1. `await import("@/integrations/supabase/client.server")` dentro do handler
  2. `supabaseAdmin.auth.admin.inviteUserByEmail(email, { data: { full_name, company_id, role }, redirectTo: <origin>/auth })`
  3. Faz `upsert` em `profiles` com `id` = usuário criado, `company_id`, `full_name`, `email`, `role`, `status: 'convite_pendente'`
  4. Em caso de erro (ex: email já existente), retorna `{ ok: false, error }`; em sucesso `{ ok: true, userId }`
- Tratamento de duplicidade: se `inviteUserByEmail` falhar com "already registered", retorna mensagem amigável

### 2. `src/routes/_authenticated/configuracoes/usuarios.tsx` (editar)
- Substituir o `supabase.from("profiles").insert(...)` do `InviteUserModal` por `useServerFn(inviteUser)`
- Toast de sucesso/erro conforme retorno
- Resto da página (listagem, editar, ativar/desativar, remover) permanece intacto

## Detalhes técnicos

- O handler usa import dinâmico para `client.server` (regra do template — `.functions.ts` faz parte do bundle do cliente, só o corpo do handler é stripado)
- `redirectTo` aponta para `/auth` do app para que o convite leve o usuário ao fluxo de login/definir senha
- Nenhuma migration nova; tabela `profiles` já tem todas as colunas necessárias
- Nenhum outro arquivo é alterado

## Fora de escopo
- Reenvio de convite (hoje só mostra toast) — pode ser adicionado depois reusando a mesma fn
- Edição de senha do convidado — feito via fluxo nativo do Supabase ao clicar no link
