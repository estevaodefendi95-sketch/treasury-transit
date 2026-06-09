
## Contexto

O repositório `Financeiro` no GitHub é uma exportação Taskade contendo:
- App React (CRA + React Router DOM + Zustand + Supabase) em `apps/default/src/`
- Módulos: Auth (Login/Register/Onboarding), Dashboard, Financeiro (Calendário, Transações, Contas a Pagar/Receber, Fluxo de Caixa, Conciliação), Vendas (Clientes, Pedidos, Produtos), Estoque, Relatórios, Configurações
- Componentes UI shadcn já presentes
- Agente IA "SuaEmpresa — Assistente de Gestão" e automação Taskade

O Lovable usa **TanStack Start** (não CRA + React Router DOM). Não é possível copiar `App.tsx` e os arquivos de rota diretamente — a estrutura de roteamento, providers e chamadas de servidor são diferentes. Será uma **reescrita estrutural** preservando UI, lógica de negócio e schema de dados.

## Escopo desta entrega

Conforme suas respostas:
- **Conectar ao Supabase existente** do projeto (você fornecerá URL + anon key)
- Reconstruir **Dashboard + Financeiro + Vendas** (Estoque/Relatórios/Configurações ficam para depois)
- Manter autenticação Supabase (login, registro, onboarding)

## O que será construído

### 1. Integração Supabase
- Criar `src/integrations/supabase/client.ts` (browser) usando `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` que você fornecerá via secrets
- Criar `src/integrations/supabase/types.ts` (placeholder — você poderá colar os types gerados depois)
- Hook `useAuth` que escuta `onAuthStateChange` no `__root.tsx`

### 2. Estrutura de rotas (TanStack Start, em `src/routes/`)
```
__root.tsx                       (já existe — adicionar QueryClient + auth listener)
index.tsx                        (landing → redirect /dashboard ou /auth)
auth.tsx                         (login + registro com tabs)
onboarding.tsx                   (configurar empresa)
_authenticated/route.tsx         (gate; redirect /auth se não logado)
_authenticated/dashboard.tsx
_authenticated/financeiro/calendario.tsx
_authenticated/financeiro/transacoes.tsx
_authenticated/financeiro/contas-pagar.tsx
_authenticated/financeiro/contas-receber.tsx
_authenticated/financeiro/fluxo-caixa.tsx
_authenticated/financeiro/conciliacao.tsx
_authenticated/vendas/clientes.tsx
_authenticated/vendas/pedidos.tsx
_authenticated/vendas/produtos.tsx
```

### 3. Layout
- `src/components/layout/AppLayout.tsx` com Sidebar de navegação (baseado no `Sidebar.tsx` original — menu: Dashboard / Financeiro (expansível) / Vendas (expansível))
- Topbar com nome do usuário, empresa, toggle dark mode, logout
- Aplicado via `_authenticated/route.tsx` envolvendo `<Outlet />`

### 4. Estado (Zustand)
- `src/store/useStore.ts` portado do original: `useAuthStore` (sessão/empresa/onboarding) e `useAppStore` (transações, contas, clientes, pedidos, produtos, com `loadFromSupabase`)

### 5. Páginas
Cada página reescrita com:
- shadcn components já existentes em `src/components/ui/`
- Tabelas com filtros, modais de criar/editar, badges de status
- Formato BR (R$ 1.000,00, datas dd/mm/aaaa)
- Cálculos: saldo, total a pagar/receber, gráficos no Dashboard (usando `recharts` já disponível)

### 6. Configuração
- Adicionar dependências faltantes via `bun add`: `zustand`, `date-fns`, `recharts` (verificar)
- Atualizar `src/styles.css` com paleta neutra profissional (mantendo tokens semânticos)
- Substituir o placeholder em `src/routes/index.tsx`

## O que **não** será feito agora
- Migração do schema Supabase — você usará as tabelas que já existem no projeto Supabase original
- Módulos Estoque, Relatórios, Configurações (fica para iteração seguinte)
- Agente IA / automações Taskade (não são parte do app web)
- Importar dados — a aplicação lerá o Supabase existente direto

## O que preciso de você antes de implementar

1. **URL do projeto Supabase** (ex: `https://xxxxx.supabase.co`)
2. **Publishable / anon key** do Supabase
3. **Confirmação do schema**: as tabelas (`transacoes`, `contas_pagar`, `contas_receber`, `clientes`, `pedidos`, `produtos`, `empresas`, `profiles`, etc.) já existem no seu Supabase? Se sim, idealmente cole o output de `supabase gen types typescript` ou descreva os nomes/colunas — sem isso, criarei tipos genéricos baseados no que o código original usa.

Após sua aprovação do plano e envio dessas credenciais, implemento em sequência: integração Supabase → layout/auth → Dashboard → Financeiro → Vendas.
