import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Repeat } from "lucide-react";
import { RECURRENCES, type Recurrence } from "@/lib/payment";

interface Props {
  value: Recurrence;
  onChange: (v: Recurrence) => void;
}

export function RecurrenceSelect({ value, onChange }: Props) {
  return (
    <div className="space-y-1">
      <Label>Recorrência</Label>
      <select
        className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as Recurrence)}
      >
        {RECURRENCES.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      {value !== "unico" && (
        <div className="text-[11px] text-muted-foreground">
          Serão gerados todos os lançamentos futuros até 24 meses.
        </div>
      )}
    </div>
  );
}

interface BadgeProps {
  tx: { recurrence?: string | null; installment_number?: number | null; total_installments?: number | null };
  className?: string;
}

export function RecurrenceBadge({ tx, className }: BadgeProps) {
  const hasRecurrence = tx.recurrence && tx.recurrence !== "unico";
  const hasInstallments = tx.installment_number && tx.total_installments && tx.total_installments > 1;
  if (!hasRecurrence && !hasInstallments) return null;
  const label = hasInstallments
    ? `${tx.installment_number}/${tx.total_installments}`
    : tx.recurrence;
  return (
    <Badge
      variant="outline"
      className={`bg-amber-50 text-amber-800 border-amber-200 text-[10px] gap-1 ${className ?? ""}`}
      title={hasRecurrence ? `Recorrência ${tx.recurrence}` : "Parcelado"}
    >
      <Repeat className="h-2.5 w-2.5" />
      {label}
    </Badge>
  );
}
