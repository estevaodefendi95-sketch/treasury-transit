## Problema

Ao salvar, o Postgres rejeita com:
- `categories_type_check` — o código envia `"income"` / `"expense"`, mas o CHECK do banco aceita outros valores (provavelmente `"receita"` / `"despesa"`, já que o resto do app está em PT-BR).
- O mesmo provavelmente atinge `bank_statements.type` (`"credito"` / `"debito"`) e `transactions.status` (`"paid"` / `"received"` / `"pending"` / `"canceled"`), quebrando a importação de extrato.

Como não tenho acesso direto ao banco neste modo, o passo 1 é descobrir o conjunto exato de valores aceitos.

## Passo 1 — Descobrir os valores aceitos (1 query)

Rodar no SQL editor:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in (
  'public.categories'::regclass,
  'public.transactions'::regclass,
  'public.bank_statements'::regclass
) and contype = 'c';
```

Cole o resultado no chat. Com isso eu sei exatamente o que cada coluna espera.

## Passo 2 — Alinhar o código ao banco

Estratégia: **adaptar o código ao schema existente** (sem migration), criando um pequeno mapa de tradução em `src/lib/db.ts`:

```
UI/código          →  Banco
"income"           →  ? (ex.: "receita")
"expense"          →  ? (ex.: "despesa")
"credito"          →  ? (ex.: "entrada"/"credit")
"debito"           →  ? (ex.: "saida"/"debit")
"paid"/"received"  →  ? (ex.: "pago"/"recebido")
"pending"          →  ? (ex.: "pendente")
"canceled"         →  ? (ex.: "cancelado")
```

Arquivos a tocar (apenas onde insere/atualiza):

1. `src/lib/db.ts` — exportar helpers `toDbCategoryType`, `toDbTxStatus`, `toDbStmtType` (+ inverso para leitura, se necessário).
2. `src/routes/_authenticated/financeiro/categorias.tsx` — converter `form.type` antes do insert/update.
3. `src/routes/_authenticated/financeiro/importar.tsx` — converter `status`, `type` e o `type` do `bank_statements` antes de cada `insert`/`update`.
4. `src/routes/_authenticated/financeiro/transacoes.tsx`, `contas-pagar.tsx`, `contas-receber.tsx` — auditoria rápida dos inserts/updates de status.
5. `src/lib/db.ts` — `DEFAULT_CATEGORIES` (seed) também precisa usar os valores válidos.
6. Filtros e comparações no front (`t.status === "paid"` etc.) continuam funcionando porque a leitura usa os mesmos valores do banco; ajustamos as comparações junto com o mapa.

Se preferir manter o app falando inglês, alternativa em vez do passo acima é uma **migration** que altera os CHECKs/enums para aceitar `income`/`expense`/`paid`/`received`/`pending`/`canceled`/`credito`/`debito`. Só sigo por aí se você confirmar explicitamente — caso contrário mantenho a opção sem migration (mais segura, não toca dados existentes).

## Passo 3 — Validar

- Criar uma categoria de despesa e uma de receita.
- Importar um OFX pequeno e finalizar com 1 link + 1 create + 1 ignore.
- Conferir que `bank_statements`, `transactions` e `categories` recebem linhas sem erro.

## Depois disso

Confirmado o salvamento, sigo o roadmap combinado:
**Fluxo de Caixa avançado → DRE → Previsões → Indicadores.**

## O que preciso de você agora

1. Resultado do SELECT do Passo 1 (ou print do erro do extrato, se for diferente do de categoria).
2. Confirmar: **adaptar código** (default, sem migration) ou **alterar o schema** (migration).