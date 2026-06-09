import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  MessageCircle,
  Copy,
  Check,
  Sparkles,
  Loader2,
  ExternalLink,
  History,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  transactionsQuery,
  customersQuery,
  formatBRL,
  formatDateBR,
  todayISO,
  type Transaction,
  type Customer,
} from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { chargingMessage } from "@/lib/ai.functions";
import { whatsappLink } from "@/lib/charging";

export const Route = createFileRoute("/_authenticated/cobrancas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Cobranças" }] }),
  component: CobrancasPage,
});

type Row = {
  tx: Transaction;
  customer: Customer | undefined;
  daysOverdue: number;
};

function daysFromToday(iso: string): number {
  const today = new Date(todayISO()).getTime();
  const d = new Date(iso).getTime();
  return Math.floor((today - d) / 86_400_000);
}

function CobrancasPage() {
  const { companyId, user } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: transactions = [] } = useQuery(transactionsQuery(companyId));
  const { data: customers = [] } = useQuery(customersQuery(companyId));

  const customersById = useMemo(() => {
    const m: Record<string, Customer> = {};
    for (const c of customers) m[c.id] = c;
    return m;
  }, [customers]);

  const rows: Row[] = useMemo(() => {
    const today = todayISO();
    return transactions
      .filter(
        (t) =>
          t.type === "income" &&
          t.status !== "received" &&
          t.status !== "paid" &&
          t.status !== "canceled",
      )
      .map((t) => ({
        tx: t,
        customer: t.customer_id ? customersById[t.customer_id] : undefined,
        daysOverdue: t.due_date < today ? daysFromToday(t.due_date) : 0,
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue || a.tx.due_date.localeCompare(b.tx.due_date));
  }, [transactions, customersById]);

  const totals = useMemo(() => {
    const today = todayISO();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekISO = weekEnd.toISOString().slice(0, 10);
    let aberto = 0,
      vencido = 0,
      hoje = 0,
      semana = 0;
    for (const r of rows) {
      const amt = Number(r.tx.amount);
      aberto += amt;
      if (r.tx.due_date < today) vencido += amt;
      else if (r.tx.due_date === today) hoje += amt;
      if (r.tx.due_date >= today && r.tx.due_date <= weekISO) semana += amt;
    }
    return { aberto, vencido, hoje, semana };
  }, [rows]);

  const [selected, setSelected] = useState<Row | null>(null);
  const [genMessage, setGenMessage] = useState<string>("");

  const ai = useServerFn(chargingMessage);
  const genMut = useMutation({
    mutationFn: async (row: Row) =>
      ai({
        data: {
          customer_name: row.customer?.name ?? "Cliente",
          amount: Number(row.tx.amount),
          due_date: row.tx.due_date,
          days_overdue: row.daysOverdue,
        },
      }),
    onSuccess: (data) => setGenMessage(data.message),
    onError: (e: Error) => toast.error(e.message),
  });

  const logMut = useMutation({
    mutationFn: async ({
      tx,
      channel,
      message,
    }: {
      tx: Transaction;
      channel: string;
      message: string;
    }) => {
      if (!companyId) throw new Error("Sem empresa");
      const { error } = await supabase.from("charging_logs").insert({
        company_id: companyId,
        transaction_id: tx.id,
        channel,
        message,
        sent_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cobrança registrada");
      qc.invalidateQueries({ queryKey: ["charging_logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openWhatsApp = () => {
    if (!selected) return;
    const link = whatsappLink(selected.customer?.phone, genMessage);
    if (!link) {
      toast.error("Cliente sem telefone cadastrado");
      return;
    }
    logMut.mutate({ tx: selected.tx, channel: "whatsapp", message: genMessage });
    window.open(link, "_blank");
  };

  const copyMessage = async () => {
    await navigator.clipboard.writeText(genMessage);
    toast.success("Mensagem copiada");
    if (selected)
      logMut.mutate({ tx: selected.tx, channel: "manual", message: genMessage });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cobranças"
        description="Gerencie recebíveis em aberto e envie cobranças por WhatsApp."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total em aberto" value={totals.aberto} />
        <KpiCard label="Total vencido" value={totals.vencido} tone="text-rose-600" />
        <KpiCard label="Vence hoje" value={totals.hoje} tone="text-amber-600" />
        <KpiCard label="Vence esta semana" value={totals.semana} tone="text-sky-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recebíveis pendentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState icon="🎉" title="Nenhuma cobrança pendente" description="Todos os recebíveis estão em dia!" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Atraso</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.tx.id}>
                    <TableCell className="font-medium">
                      {r.customer?.name ?? "—"}
                      {r.customer?.phone && (
                        <div className="text-[10px] text-muted-foreground">
                          {r.customer.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.tx.description}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatBRL(Number(r.tx.amount))}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateBR(r.tx.due_date)}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.daysOverdue > 0 ? (
                        <Badge variant="destructive">
                          {r.daysOverdue}d
                        </Badge>
                      ) : r.daysOverdue === 0 && r.tx.due_date === todayISO() ? (
                        <Badge className="bg-amber-500">hoje</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelected(r);
                            setGenMessage("");
                            genMut.mutate(r);
                          }}
                        >
                          <MessageCircle className="h-3.5 w-3.5 mr-1" />
                          Cobrar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelected(r)}
                          title="Histórico"
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              Mensagem de cobrança
            </DialogTitle>
            <DialogDescription>
              {selected?.customer?.name} — {selected && formatBRL(Number(selected.tx.amount))}
            </DialogDescription>
          </DialogHeader>

          {genMut.isPending ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2 py-6 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando mensagem com IA…
            </div>
          ) : (
            <>
              <Textarea
                rows={6}
                value={genMessage}
                onChange={(e) => setGenMessage(e.target.value)}
                placeholder="Mensagem aparecerá aqui..."
              />
              <ChargingHistory transactionId={selected?.tx.id ?? null} />
            </>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => selected && genMut.mutate(selected)}
              disabled={genMut.isPending}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              Regerar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyMessage}
              disabled={!genMessage}
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copiar
            </Button>
            <Button
              size="sm"
              onClick={openWhatsApp}
              disabled={!genMessage || !selected?.customer?.phone}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              WhatsApp
            </Button>
            {selected && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  logMut.mutate({
                    tx: selected.tx,
                    channel: "manual",
                    message: genMessage || "Marcado como cobrado",
                  })
                }
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Marcar cobrado
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-lg font-bold mt-1 ${tone ?? ""}`}>
          {formatBRL(value)}
        </div>
      </CardContent>
    </Card>
  );
}

function ChargingHistory({ transactionId }: { transactionId: string | null }) {
  const { data: logs = [] } = useQuery({
    queryKey: ["charging_logs", transactionId],
    queryFn: async () => {
      if (!transactionId) return [];
      const { data, error } = await supabase
        .from("charging_logs")
        .select("*")
        .eq("transaction_id", transactionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!transactionId,
  });
  if (!logs.length) return null;
  return (
    <div className="border-t pt-3 mt-2">
      <div className="text-xs font-medium mb-1.5">Histórico</div>
      <ul className="space-y-1 text-[11px] text-muted-foreground">
        {logs.map((l: { id: string; channel: string; created_at: string }) => (
          <li key={l.id}>
            Enviada via <span className="font-medium">{l.channel}</span> em{" "}
            {new Date(l.created_at).toLocaleString("pt-BR")}
          </li>
        ))}
      </ul>
    </div>
  );
}
