// ============================================================================
// Helpers para métodos de pagamento e recorrência
// ============================================================================

export type PaymentMethod =
  | "pix"
  | "boleto"
  | "credito"
  | "debito"
  | "dinheiro"
  | "cheque"
  | "ted"
  | "doc";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "credito", label: "Cartão de Crédito" },
  { value: "debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
  { value: "ted", label: "TED" },
  { value: "doc", label: "DOC" },
];

export const PAYMENT_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_METHODS.map((m) => [m.value, m.label]),
);

// Cor do badge por método. Classes Tailwind diretas para badges leves.
export const PAYMENT_BADGE_CLASS: Record<string, string> = {
  pix: "bg-emerald-100 text-emerald-800 border-emerald-200",
  boleto: "bg-blue-100 text-blue-800 border-blue-200",
  credito: "bg-purple-100 text-purple-800 border-purple-200",
  debito: "bg-indigo-100 text-indigo-800 border-indigo-200",
  dinheiro: "bg-gray-100 text-gray-800 border-gray-200",
  cheque: "bg-amber-100 text-amber-800 border-amber-200",
  ted: "bg-cyan-100 text-cyan-800 border-cyan-200",
  doc: "bg-cyan-100 text-cyan-800 border-cyan-200",
};

// ---------- PIX ----------
export const PIX_KEY_TYPES = [
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "Email" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Aleatória" },
] as const;

// ---------- Cartão ----------
export const CARD_BRANDS = [
  { value: "visa", label: "Visa" },
  { value: "master", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "Amex" },
  { value: "hipercard", label: "Hipercard" },
] as const;

// ---------- Boleto ----------
/** Mantém apenas dígitos e formata em grupos de 10 (47 dígitos = 4 grupos + 7). */
export function formatBoletoBarcode(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 47);
  return digits.replace(/(\d{10})/g, "$1 ").trim();
}

export function digitCount(s: string | null | undefined): number {
  if (!s) return 0;
  return (s.match(/\d/g) ?? []).length;
}

// ---------- Recorrência ----------
export type Recurrence =
  | "unico"
  | "semanal"
  | "quinzenal"
  | "mensal"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";

export const RECURRENCES: { value: Recurrence; label: string }[] = [
  { value: "unico", label: "Único" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "bimestral", label: "Bimestral" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

export const RECURRENCE_LABEL: Record<string, string> = Object.fromEntries(
  RECURRENCES.map((r) => [r.value, r.label]),
);

/** Soma um período de recorrência a uma data ISO (YYYY-MM-DD). */
export function addRecurrencePeriod(iso: string, rec: Recurrence): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  switch (rec) {
    case "semanal":
      dt.setUTCDate(dt.getUTCDate() + 7);
      break;
    case "quinzenal":
      dt.setUTCDate(dt.getUTCDate() + 15);
      break;
    case "mensal":
      dt.setUTCMonth(dt.getUTCMonth() + 1);
      break;
    case "bimestral":
      dt.setUTCMonth(dt.getUTCMonth() + 2);
      break;
    case "trimestral":
      dt.setUTCMonth(dt.getUTCMonth() + 3);
      break;
    case "semestral":
      dt.setUTCMonth(dt.getUTCMonth() + 6);
      break;
    case "anual":
      dt.setUTCFullYear(dt.getUTCFullYear() + 1);
      break;
    default:
      return iso;
  }
  return dt.toISOString().slice(0, 10);
}

/** Quantas instâncias gerar em 24 meses, dada a recorrência. Inclui a primeira. */
export function recurrenceCount(rec: Recurrence): number {
  switch (rec) {
    case "semanal":
      return 104; // ~52 * 2
    case "quinzenal":
      return 48;
    case "mensal":
      return 24;
    case "bimestral":
      return 12;
    case "trimestral":
      return 8;
    case "semestral":
      return 4;
    case "anual":
      return 2;
    default:
      return 1;
  }
}

/** Gera todas as datas futuras (incluindo a inicial) para a recorrência, até 24 meses. */
export function buildRecurrenceDates(startISO: string, rec: Recurrence): string[] {
  if (rec === "unico") return [startISO];
  const out = [startISO];
  let cur = startISO;
  const max = recurrenceCount(rec);
  for (let i = 1; i < max; i++) {
    cur = addRecurrencePeriod(cur, rec);
    out.push(cur);
  }
  return out;
}

export const RECURRENCE_INTERVAL_MONTHS: Record<string, number | null> = {
  semanal: null,
  quinzenal: null,
  mensal: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

/** Copia uma chave PIX para o clipboard. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
