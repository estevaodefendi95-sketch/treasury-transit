// Default charging schedule (régua de cobrança)
export type ChargingRule = {
  days_offset: number;
  channel: "email" | "whatsapp" | "manual";
  message_template: string;
  is_active: boolean;
};

export const DEFAULT_CHARGING_RULES: ChargingRule[] = [
  {
    days_offset: -3,
    channel: "whatsapp",
    message_template:
      "Olá, {cliente}! Lembramos que seu boleto/PIX de {valor} vence em 3 dias ({vencimento}). Qualquer dúvida estamos à disposição.",
    is_active: true,
  },
  {
    days_offset: 0,
    channel: "whatsapp",
    message_template:
      "Olá, {cliente}! Seu pagamento de {valor} vence hoje ({vencimento}). Conte conosco para qualquer dúvida.",
    is_active: true,
  },
  {
    days_offset: 1,
    channel: "whatsapp",
    message_template:
      "Olá, {cliente}! Identificamos que o pagamento de {valor} venceu em {vencimento}. Por favor regularize ou entre em contato.",
    is_active: true,
  },
  {
    days_offset: 7,
    channel: "whatsapp",
    message_template:
      "Olá, {cliente}! Reforçamos a pendência de {valor} (vencimento {vencimento}). É importante regularizar para evitar maiores transtornos.",
    is_active: true,
  },
  {
    days_offset: 30,
    channel: "email",
    message_template:
      "Prezado(a) {cliente}, comunicamos que o débito de {valor} (vencimento {vencimento}) será encaminhado para cobrança caso não seja regularizado.",
    is_active: true,
  },
];

export function renderTemplate(
  template: string,
  vars: { cliente: string; valor: string; vencimento: string; dias?: number },
) {
  return template
    .replace(/\{cliente\}/g, vars.cliente)
    .replace(/\{valor\}/g, vars.valor)
    .replace(/\{vencimento\}/g, vars.vencimento)
    .replace(/\{dias\}/g, String(vars.dias ?? 0));
}

export function whatsappLink(phone: string | null | undefined, text: string): string | null {
  if (!phone) return null;
  // strip non-digits
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  // assume Brazilian if 10/11 digits
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}`;
}
