import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import {
  PAYMENT_METHODS,
  PIX_KEY_TYPES,
  CARD_BRANDS,
  formatBoletoBarcode,
  digitCount,
  copyToClipboard,
  type PaymentMethod,
} from "@/lib/payment";

export type PaymentFields = {
  payment_method: PaymentMethod | "";
  pix_key_type: string;
  pix_key: string;
  pix_qr_code: string;
  boleto_barcode: string;
  linha_digitavel: string;
  boleto_due_date: string;
  card_brand: string;
  card_installments: number;
  card_invoice_date: string;
};

export const emptyPaymentFields: PaymentFields = {
  payment_method: "",
  pix_key_type: "",
  pix_key: "",
  pix_qr_code: "",
  boleto_barcode: "",
  linha_digitavel: "",
  boleto_due_date: "",
  card_brand: "",
  card_installments: 1,
  card_invoice_date: "",
};

interface Props {
  value: PaymentFields;
  amount: number;
  onChange: (v: PaymentFields) => void;
}

export function PaymentMethodFields({ value, amount, onChange }: Props) {
  const set = <K extends keyof PaymentFields>(k: K, v: PaymentFields[K]) =>
    onChange({ ...value, [k]: v });

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    toast[ok ? "success" : "error"](ok ? `${label} copiado!` : "Falha ao copiar");
  };

  const handleQrUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => set("pix_qr_code", String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  const m = value.payment_method;
  const barcodeDigits = digitCount(value.boleto_barcode);
  const installmentValue = amount && value.card_installments > 0 ? amount / value.card_installments : 0;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Forma de pagamento</Label>
        <select
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={m}
          onChange={(e) => set("payment_method", e.target.value as PaymentMethod | "")}
        >
          <option value="">— Selecione —</option>
          {PAYMENT_METHODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {m === "pix" && (
        <div className="space-y-2 rounded-md border bg-emerald-50/40 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Tipo de chave</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={value.pix_key_type}
                onChange={(e) => set("pix_key_type", e.target.value)}
              >
                <option value="">—</option>
                {PIX_KEY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Chave PIX</Label>
              <div className="flex gap-1">
                <Input
                  className="h-9"
                  value={value.pix_key}
                  onChange={(e) => set("pix_key", e.target.value)}
                  placeholder="Cole a chave"
                />
                {value.pix_key && (
                  <Button type="button" size="icon" variant="outline" className="h-9 w-9"
                    onClick={() => handleCopy(value.pix_key, "Chave PIX")}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">QR Code (texto ou imagem)</Label>
            <Input
              className="h-9"
              value={value.pix_qr_code.startsWith("data:") ? "[imagem carregada]" : value.pix_qr_code}
              onChange={(e) => set("pix_qr_code", e.target.value)}
              placeholder="Cole o código copia-e-cola"
            />
            <input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleQrUpload(f);
              }}
            />
          </div>
        </div>
      )}

      {m === "boleto" && (
        <div className="space-y-2 rounded-md border bg-blue-50/40 p-3">
          <div className="space-y-1">
            <Label className="text-xs">Código de barras (47 dígitos)</Label>
            <div className="flex gap-1">
              <Input
                className="h-9 font-mono text-xs"
                value={formatBoletoBarcode(value.boleto_barcode)}
                onChange={(e) => set("boleto_barcode", e.target.value.replace(/\s/g, ""))}
              />
              {value.boleto_barcode && (
                <Button type="button" size="icon" variant="outline" className="h-9 w-9"
                  onClick={() => handleCopy(value.boleto_barcode.replace(/\s/g, ""), "Código")}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className={`text-[10px] ${barcodeDigits === 47 ? "text-emerald-600" : "text-muted-foreground"}`}>
              {barcodeDigits}/47 dígitos {barcodeDigits === 47 ? "✓" : ""}
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Linha digitável</Label>
            <Input
              className="h-9 font-mono text-xs"
              value={value.linha_digitavel}
              onChange={(e) => set("linha_digitavel", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vencimento</Label>
            <Input
              type="date"
              className="h-9"
              value={value.boleto_due_date}
              onChange={(e) => set("boleto_due_date", e.target.value)}
            />
          </div>
        </div>
      )}

      {m === "credito" && (
        <div className="space-y-2 rounded-md border bg-purple-50/40 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Bandeira</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={value.card_brand}
                onChange={(e) => set("card_brand", e.target.value)}
              >
                <option value="">—</option>
                {CARD_BRANDS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parcelas</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={value.card_installments}
                onChange={(e) => set("card_installments", Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}x</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data da fatura</Label>
            <Input
              type="date"
              className="h-9"
              value={value.card_invoice_date}
              onChange={(e) => set("card_invoice_date", e.target.value)}
            />
          </div>
          {value.card_installments > 1 && installmentValue > 0 && (
            <div className="text-xs text-purple-800 font-medium">
              {value.card_installments}x de {installmentValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          )}
        </div>
      )}

      {m === "debito" && (
        <div className="space-y-2 rounded-md border bg-indigo-50/40 p-3">
          <div className="space-y-1">
            <Label className="text-xs">Bandeira</Label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={value.card_brand}
              onChange={(e) => set("card_brand", e.target.value)}
            >
              <option value="">—</option>
              {CARD_BRANDS.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
