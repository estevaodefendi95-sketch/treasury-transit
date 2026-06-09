import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  PAYMENT_LABEL,
  PAYMENT_BADGE_CLASS,
  PIX_KEY_TYPES,
  CARD_BRANDS,
  formatBoletoBarcode,
  copyToClipboard,
} from "@/lib/payment";
import type { Transaction } from "@/lib/db";

interface BadgeProps {
  method: string | null | undefined;
  className?: string;
}

export function PaymentMethodBadge({ method, className }: BadgeProps) {
  if (!method) return null;
  const cls = PAYMENT_BADGE_CLASS[method] ?? "bg-gray-100 text-gray-800 border-gray-200";
  return (
    <Badge variant="outline" className={`${cls} ${className ?? ""} text-[10px] font-medium`}>
      {PAYMENT_LABEL[method] ?? method}
    </Badge>
  );
}

interface DetailsProps {
  tx: Transaction;
}

/** Painel expansível mostrando detalhes do pagamento. */
export function PaymentMethodDetails({ tx }: DetailsProps) {
  const [open, setOpen] = useState(false);

  const hasAnyDetail =
    tx.pix_key ||
    tx.pix_qr_code ||
    tx.boleto_barcode ||
    tx.linha_digitavel ||
    tx.boleto_due_date ||
    tx.card_brand ||
    tx.card_installments ||
    tx.card_invoice_date;

  if (!tx.payment_method && !hasAnyDetail) return null;

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    toast[ok ? "success" : "error"](ok ? `${label} copiado!` : "Falha ao copiar");
  };

  const pixKeyTypeLabel = PIX_KEY_TYPES.find((t) => t.value === tx.pix_key_type)?.label;
  const brandLabel = CARD_BRANDS.find((b) => b.value === tx.card_brand)?.label;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Ver detalhes do pagamento
      </button>

      {open && (
        <div className="mt-2 space-y-2 text-xs">
          {tx.payment_method === "pix" && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 space-y-1">
              {pixKeyTypeLabel && (
                <div><span className="font-medium">Tipo:</span> {pixKeyTypeLabel}</div>
              )}
              {tx.pix_key && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Chave:</span>
                  <code className="bg-white px-1.5 py-0.5 rounded border text-[11px] flex-1 truncate">
                    {tx.pix_key}
                  </code>
                  <Button type="button" size="sm" variant="outline" className="h-6 px-2"
                    onClick={() => handleCopy(tx.pix_key!, "Chave PIX")}>
                    <Copy className="h-3 w-3 mr-1" />Copiar
                  </Button>
                </div>
              )}
              {tx.pix_qr_code && tx.pix_qr_code.startsWith("data:image") && (
                <img src={tx.pix_qr_code} alt="QR PIX" className="h-32 w-32 mt-1 border rounded" />
              )}
              {tx.pix_qr_code && !tx.pix_qr_code.startsWith("data:image") && (
                <details>
                  <summary className="cursor-pointer text-[11px]">Código copia-e-cola</summary>
                  <code className="block bg-white p-2 mt-1 rounded border text-[10px] break-all">{tx.pix_qr_code}</code>
                </details>
              )}
            </div>
          )}

          {tx.payment_method === "boleto" && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-1">
              {tx.boleto_barcode && (
                <div className="flex items-center gap-2">
                  <span className="font-medium">Código:</span>
                  <code className="bg-white px-1.5 py-0.5 rounded border text-[10px] flex-1 truncate font-mono">
                    {formatBoletoBarcode(tx.boleto_barcode)}
                  </code>
                  <Button type="button" size="sm" variant="outline" className="h-6 px-2"
                    onClick={() => handleCopy(tx.boleto_barcode!, "Código")}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {tx.linha_digitavel && (
                <div><span className="font-medium">Linha:</span> <code className="text-[10px]">{tx.linha_digitavel}</code></div>
              )}
              {tx.boleto_due_date && (
                <div><span className="font-medium">Vencimento:</span> {tx.boleto_due_date}</div>
              )}
            </div>
          )}

          {tx.payment_method === "credito" && (
            <div className="rounded-md border border-purple-200 bg-purple-50 p-3 space-y-1">
              {brandLabel && <div><span className="font-medium">Bandeira:</span> {brandLabel}</div>}
              {tx.card_installments && tx.card_installments > 1 && (
                <div><span className="font-medium">Parcelas:</span> {tx.card_installments}x</div>
              )}
              {tx.installment_number && tx.total_installments && (
                <div><span className="font-medium">Parcela:</span> {tx.installment_number}/{tx.total_installments}</div>
              )}
              {tx.card_invoice_date && (
                <div><span className="font-medium">Fatura:</span> {tx.card_invoice_date}</div>
              )}
            </div>
          )}

          {tx.payment_method === "debito" && brandLabel && (
            <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
              <span className="font-medium">Bandeira:</span> {brandLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Bloco verde com chave PIX em transação de RECEITA — pra cliente pagar facilmente. */
export function PixReceiveBox({ tx }: { tx: Transaction }) {
  if (tx.type !== "income" || tx.payment_method !== "pix" || !tx.pix_key) return null;
  const handleCopy = async () => {
    const ok = await copyToClipboard(tx.pix_key!);
    toast[ok ? "success" : "error"](ok ? "Chave PIX copiada!" : "Falha ao copiar");
  };
  return (
    <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-3 space-y-2">
      <div className="text-xs font-semibold text-emerald-900">💰 Receber via PIX</div>
      <div className="flex items-center gap-2">
        <code className="bg-white px-2 py-1 rounded border text-sm flex-1 truncate font-mono">
          {tx.pix_key}
        </code>
        <Button type="button" size="sm" onClick={handleCopy}
          className="bg-emerald-600 hover:bg-emerald-700">
          <Copy className="h-3 w-3 mr-1" />Copiar
        </Button>
      </div>
    </div>
  );
}
