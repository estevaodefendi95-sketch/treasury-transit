import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const SHORTCUTS = [
  { keys: "N", desc: "Novo lançamento" },
  { keys: "I", desc: "Importar extrato" },
  { keys: "F", desc: "Focar busca / filtrar" },
  { keys: "Esc", desc: "Fechar modal / painel" },
  { keys: "?", desc: "Mostrar esta ajuda" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
          <DialogDescription>Acelere o uso com estes atalhos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between border-b last:border-0 py-2">
              <span className="text-sm">{s.desc}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-muted rounded border border-border">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
