import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const MODEL = "google/gemini-3-flash-preview";

function getModel() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const gw = createLovableAiGatewayProvider(key);
  return gw(MODEL);
}

// ---------- 1) Categorizar transação ----------
const CategorizeInput = z.object({
  description: z.string().min(1),
  amount: z.number(),
  type: z.enum(["income", "expense"]),
  categories: z.array(
    z.object({ id: z.string(), name: z.string(), type: z.string() }),
  ),
});

export const categorizeTransaction = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CategorizeInput.parse(d))
  .handler(async ({ data }) => {
    const eligible = data.categories.filter(
      (c) => !c.type || c.type === data.type,
    );
    if (eligible.length === 0) {
      return { category_id: null, category_name: null, confidence: 0, reason: "Sem categorias disponíveis" };
    }
    const list = eligible
      .map((c) => `- id=${c.id} | ${c.name}`)
      .join("\n");

    try {
      const { output } = await generateText({
        model: getModel(),
        system:
          "Você categoriza transações financeiras de empresas brasileiras. Responda APENAS com o JSON pedido, sem explicação extra.",
        prompt: `Transação:
descrição: "${data.description}"
valor: R$ ${data.amount.toFixed(2)}
tipo: ${data.type === "income" ? "receita" : "despesa"}

Categorias disponíveis (escolha UMA):
${list}

Responda com a melhor categoria. confidence = probabilidade (0 a 1). reason curto em português.`,
        output: Output.object({
          schema: z.object({
            category_id: z.string(),
            category_name: z.string(),
            confidence: z.number().min(0).max(1),
            reason: z.string(),
          }),
        }),
      });
      // valida id existe
      const found = eligible.find((c) => c.id === output.category_id);
      if (!found) {
        return { ...output, category_id: eligible[0].id, category_name: eligible[0].name, confidence: 0.3 };
      }
      return output;
    } catch (e) {
      console.error("categorizeTransaction error", e);
      return { category_id: null, category_name: null, confidence: 0, reason: "Erro IA" };
    }
  });

// ---------- 2) Parse PDF extrato ----------
const ParsePdfInput = z.object({ text: z.string().min(10) });

export const parsePdfStatement = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ParsePdfInput.parse(d))
  .handler(async ({ data }) => {
    const truncated = data.text.slice(0, 30000);
    const { output } = await generateText({
      model: getModel(),
      system:
        "Você é um parser de extrato bancário brasileiro. Responda APENAS o JSON pedido. Datas no formato YYYY-MM-DD. Valores sempre positivos com 2 decimais; o sinal vem em type (credito ou debito).",
      prompt: `Extraia TODAS as transações do extrato abaixo. Ignore saldos, cabeçalhos, totais.

EXTRATO:
${truncated}`,
      output: Output.object({
        schema: z.object({
          transactions: z.array(
            z.object({
              date: z.string(),
              description: z.string(),
              amount: z.number(),
              type: z.enum(["credito", "debito"]),
            }),
          ),
        }),
      }),
    });
    return output.transactions;
  });

// ---------- 3) Aprender regra de renomeação ----------
const LearnNameInput = z.object({
  original: z.string().min(1),
  new_name: z.string().min(1),
});

export const learnNameRule = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => LearnNameInput.parse(d))
  .handler(async ({ data }) => {
    const { output } = await generateText({
      model: getModel(),
      system:
        "Crie regras de normalização de descrições de extratos bancários brasileiros. Responda APENAS o JSON pedido. O pattern deve ser uma substring estável (não regex completo) que apareça em descrições semelhantes — sem datas, IDs ou números variáveis.",
      prompt: `Usuário renomeou:
original: "${data.original}"
novo: "${data.new_name}"

Gere uma regra reutilizável.`,
      output: Output.object({
        schema: z.object({
          pattern: z.string().min(2),
          suggested_name: z.string().min(1),
          confidence: z.number().min(0).max(1),
        }),
      }),
    });
    return output;
  });

// ---------- 4) Narrativa de Fluxo de Caixa ----------
const CashflowInput = z.object({
  days: z.number().int().positive(),
  current_balance: z.number(),
  scheduled_receivables: z.number(),
  scheduled_payables: z.number(),
  overdue_receivables: z.number(),
  projected_balance: z.number(),
});

export const cashflowNarrative = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => CashflowInput.parse(d))
  .handler(async ({ data }) => {
    const fmt = (n: number) =>
      n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    try {
      const { text } = await generateText({
        model: getModel(),
        system:
          "Você é um consultor financeiro brasileiro para PMEs. Seja conciso e prático. Responda SEMPRE em português do Brasil.",
        prompt: `Analise este fluxo de caixa para os próximos ${data.days} dias:
Saldo atual: ${fmt(data.current_balance)}
Recebíveis programados: ${fmt(data.scheduled_receivables)}
Pagamentos programados: ${fmt(data.scheduled_payables)}
Recebíveis em atraso: ${fmt(data.overdue_receivables)}
Saldo projetado em ${data.days} dias: ${fmt(data.projected_balance)}

Escreva EXATAMENTE 3 frases curtas em português:
1. Avaliação da saúde financeira atual.
2. Principal risco ou oportunidade identificada.
3. Uma recomendação prática e específica.

Não use marcadores, numeração ou títulos. Apenas 3 frases corridas.`,
      });
      return { narrative: text.trim() };
    } catch (e) {
      console.error("cashflowNarrative error", e);
      return {
        narrative:
          "Não foi possível gerar a análise no momento. Verifique sua conexão e tente novamente.",
      };
    }
  });
