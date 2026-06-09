import { formatDateBR } from "@/lib/db";
import type { Transaction } from "@/lib/db";

export function ApprovalTimeline({
  tx,
  logs,
}: {
  tx: Transaction;
  logs: { id: string; action: string; comment: string | null; created_at: string; approved_by: string | null }[];
}) {
  const created = tx.created_at;
  const needsApproval = tx.approval_status && tx.approval_status !== "aprovado";
  return (
    <div className="border-t pt-4">
      <div className="font-medium mb-2 text-sm">Histórico de aprovação</div>
      <ol className="space-y-2 text-xs">
        {created && (
          <li className="flex gap-2">
            <span className="text-amber-500 text-base leading-none">🟡</span>
            <div>
              <div>Criado em {formatDateBR(created)}</div>
              <div className="text-muted-foreground text-[10px]">
                {new Date(created).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </li>
        )}
        {(needsApproval || logs.length > 0) && (
          <li className="flex gap-2">
            <span className="text-sky-500 text-base leading-none">🔵</span>
            <div>Enviado para aprovação (valor acima do limite)</div>
          </li>
        )}
        {logs.map((l) => (
          <li key={l.id} className="flex gap-2">
            <span className="text-base leading-none">
              {l.action === "aprovado" ? "🟢" : "🔴"}
            </span>
            <div>
              <div>
                {l.action === "aprovado" ? "Aprovado" : "Rejeitado"} em {formatDateBR(l.created_at)}
              </div>
              <div className="text-muted-foreground text-[10px]">
                {new Date(l.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              {l.comment && (
                <div className="mt-1 italic text-muted-foreground">"{l.comment}"</div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
