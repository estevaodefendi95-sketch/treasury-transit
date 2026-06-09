import type { BankAccount } from "@/lib/db";

interface Props {
  accounts: BankAccount[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}

export function AccountFilter({ accounts, value, onChange, className }: Props) {
  return (
    <select
      className={`h-9 rounded-md border border-input bg-background px-3 text-sm ${className ?? ""}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Todas as contas</option>
      {accounts.filter((a) => a.is_active !== false).map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </select>
  );
}

export function isTransferType(type: string | null | undefined): boolean {
  return type === "transferencia_in" || type === "transferencia_out" || type === "transferencia";
}
