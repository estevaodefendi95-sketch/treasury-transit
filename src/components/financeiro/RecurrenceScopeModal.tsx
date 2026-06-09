import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type RecurrenceScope = "one" | "future" | "all";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: (scope: RecurrenceScope) => void;
}

export function RecurrenceScopeModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  destructive = false,
  onConfirm,
}: Props) {
  const [scope, setScope] = useState<RecurrenceScope>("one");

  const options: { value: RecurrenceScope; label: string }[] = [
    { value: "one", label: "Apenas este lançamento" },
    { value: "future", label: "Este e os próximos" },
    { value: "all", label: "Todos os lançamentos da série" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </DialogHeader>
        <div className="space-y-2 py-2">
          {options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/40">
              <input
                type="radio"
                name="rec-scope"
                value={o.value}
                checked={scope === o.value}
                onChange={() => setScope(o.value)}
              />
              <span className="text-sm">{o.label}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => { onConfirm(scope); onOpenChange(false); }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
