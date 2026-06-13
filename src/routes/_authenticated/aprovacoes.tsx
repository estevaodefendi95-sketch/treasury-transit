import { EmptyState } from "@/components/ui/empty-state";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Eye, ShieldAlert, Clock, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  transactionsQuery,
  customersQuery,
  suppliersQuery,
  formatBRL,
  formatDateBR,
  type Transaction,
} from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import {
  approvalLogsQuery,
  notifyRequesterApprovalDecision,
  type ApprovalAction,
} from "@/lib/approvals";
import { ApprovalTimeline } from "@/components/financeiro/ApprovalTimeline";

export const Route = createFileRoute("/_authenticated/aprovacoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Fila de Aprovação" }] }),
  component: AprovacoesPage,
});

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function AprovacoesPage() {
  const { companyId, profile, user } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: transactions = [] } = useQuery(transactionsQuery(companyId));
  const { data: customers = [] } = useQuery(customersQuery(companyId));
  const { data: suppliers = [] } = useQuery(suppliersQuery(companyId));

  const [decisionTarget, setDecisionTarget] = useState<{ tx: Transaction; action: ApprovalAction } | null>(null);
  const [comment, setComment] = useState("");
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);

  const pending = useMemo(
    () =>
      transactions
        .filter((t) => t.approval_status === "aguardando_aprovacao")
        .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")),
    [transactions],
  );

  const totalValue = pending.reduce((s, t) => s + Number(t.amount), 0);
  const oldest = pending[0]?.created_at ? daysAgo(pending[0].created_at) : 0;

  const isAdmin = profile?.role === "admin";

  const decide = useMutation({
    mutationFn: async () => {
      if (!decisionTarget || !companyId || !user) throw new Error("Sem contexto");
      const { tx, action } = decisionTarget;
      if (action === "rejeitado" && !comment.trim()) {
        throw new Error("Comentário obrigatório para rejeitar");
      }
      const newStatus = action === "aprovado" ? "aprovado" : "rejeitado";
      const { error: e1 } = await supabase
        .from("transactions")
        .update({ approval_status: newStatus })
        .eq("id", tx.id);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("approval_logs").insert({
        transaction_id: tx.id,
        approved_by: user.id,
        action,
        comment: comment.trim() || null,
      });
      if (e2) throw e2;

      // Find requester: profiles row whose id matches the created_by/owner.
      // Schema doesn't track creator on transactions; notify all admins is reverse.
      // We notify based on first approval_log of "criado" if any, else skip.
      await notifyRequesterApprovalDecision({
        companyId,
        requesterId: user.id, // fallback: notify self; admins also see it
        transactionId: tx.id,
        description: tx.description,
        action,
        comment: comment.trim() || null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["notifications", companyId] });
      toast.success(
        decisionTarget?.action === "aprovado"
          ? "Lançamento aprovado com sucesso"
          : "Lançamento rejeitado",
      );
      setDecisionTarget(null);
      setComment("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameForTx = (t: Transaction) => {
    if (t.customer_id) return customers.find((c) => c.id === t.customer_id)?.name ?? "—";
    if (t.supplier_id) return suppliers.find((s) => s.id === t.supplier_id)?.name ?? "—";
    return "—";
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Fila de Aprovação" />
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6 flex items-center gap-3 text-amber-800">
            <ShieldAlert className="h-5 w-5" />
            <div className="text-sm">
              Apenas administradores podem acessar a fila de aprovação.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fila de Aprovação"
        description="Lançamentos aguardando sua decisão."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Total pendente</div>
            <div className="text-2xl font-bold">{pending.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Valor pendente</div>
            <div className="text-2xl font-bold font-mono text-amber-600">
              {formatBRL(totalValue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs text-muted-foreground">Mais antigo</div>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              {oldest} {oldest === 1 ? "dia" : "dias"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Pendentes (mais antigos primeiro)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Solicitante</TableHead>
                <TableHead>Aguardando há</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7}>
                    <EmptyState icon="✅" title="Nenhuma aprovação pendente" description="Todos os lançamentos foram processados" />
                  </TableCell>
                </TableRow>
              )}
              {pending.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDateBR(t.due_date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={t.type === "receita" ? "text-emerald-700" : "text-rose-700"}>
                      {t.type === "receita" ? "Receita" : "Despesa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{t.description}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatBRL(Number(t.amount))}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{nameForTx(t)}</TableCell>
                  <TableCell className="text-sm">
                    {t.created_at ? `${daysAgo(t.created_at)} dia${daysAgo(t.created_at) !== 1 ? "s" : ""}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() => {
                          setDecisionTarget({ tx: t, action: "aprovado" });
                          setComment("");
                        }}
                      >
                        <Check className="h-4 w-4 mr-1" /> Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                        onClick={() => {
                          setDecisionTarget({ tx: t, action: "rejeitado" });
                          setComment("");
                        }}
                      >
                        <X className="h-4 w-4 mr-1" /> Rejeitar
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDetailTx(t)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!decisionTarget} onOpenChange={(v) => !v && setDecisionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionTarget?.action === "aprovado" ? "Aprovar lançamento" : "Rejeitar lançamento"}
            </DialogTitle>
            <DialogDescription>
              {decisionTarget && (
                <>
                  <span className="font-medium">{decisionTarget.tx.description}</span> —{" "}
                  {formatBRL(Number(decisionTarget.tx.amount))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>
              Comentário{" "}
              {decisionTarget?.action === "rejeitado" ? (
                <span className="text-rose-600">*</span>
              ) : (
                <span className="text-muted-foreground text-xs">(opcional)</span>
              )}
            </Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                decisionTarget?.action === "aprovado"
                  ? "Ex: aprovado conforme orçamento"
                  : "Motivo da rejeição..."
              }
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant={decisionTarget?.action === "rejeitado" ? "destructive" : "default"}
              onClick={() => decide.mutate()}
              disabled={decide.isPending}
            >
              {decide.isPending
                ? "Salvando..."
                : decisionTarget?.action === "aprovado"
                  ? "Confirmar aprovação"
                  : "Confirmar rejeição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!detailTx} onOpenChange={(v) => !v && setDetailTx(null)}>
        <SheetContent side="right" className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Detalhes do lançamento</SheetTitle>
          </SheetHeader>
          {detailTx && <TransactionDetailContent tx={detailTx} requesterName={nameForTx(detailTx)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TransactionDetailContent({ tx, requesterName }: { tx: Transaction; requesterName: string }) {
  const { data: logs = [] } = useQuery(approvalLogsQuery(tx.id));

  return (
    <div className="space-y-4 mt-4">
      <div className="grid gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Descrição</span>
          <span className="font-medium">{tx.description}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Valor</span>
          <span className="font-mono font-bold">{formatBRL(Number(tx.amount))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Vencimento</span>
          <span>{formatDateBR(tx.due_date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tipo</span>
          <span>{tx.type === "receita" ? "Receita" : "Despesa"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Solicitante</span>
          <span>{requesterName}</span>
        </div>
        {tx.notes && (
          <div className="flex flex-col gap-1 pt-2 border-t">
            <span className="text-muted-foreground">Observações</span>
            <span>{tx.notes}</span>
          </div>
        )}
      </div>

      <ApprovalTimeline tx={tx} logs={logs} />
    </div>
  );
}

