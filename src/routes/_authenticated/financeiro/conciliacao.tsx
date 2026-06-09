import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { bankStatementsQuery, transactionsQuery, formatBRL, formatDateBR } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/financeiro/conciliacao")({
  ssr: false,
  head: () => ({ meta: [{ title: "Conciliação — SuaEmpresa Gestão" }] }),
  component: ConciliacaoPage,
});

function ConciliacaoPage() {
  const { companyId } = useCurrentCompany();
  const { data: statements = [] } = useQuery(bankStatementsQuery(companyId));
  const { data: transactions = [] } = useQuery(transactionsQuery(companyId));

  const pending = statements.filter((s) => !s.is_reconciled);
  const reconciled = statements.filter((s) => s.is_reconciled);
  const unmatchedTx = transactions.filter((t) => !t.is_reconciled && t.payment_date);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conciliação Bancária"
        description={`${pending.length} extratos pendentes • ${reconciled.length} conciliados`}
      />

      <Card>
        <CardHeader><CardTitle className="text-base">Extratos pendentes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Nenhum extrato pendente</TableCell></TableRow>
              )}
              {pending.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{formatDateBR(s.date)}</TableCell>
                  <TableCell>{s.description}</TableCell>
                  <TableCell><Badge variant="secondary">{s.type ?? "—"}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(Number(s.amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Transações sem conciliação ({unmatchedTx.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data pagamento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unmatchedTx.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">Tudo conciliado 🎉</TableCell></TableRow>
              )}
              {unmatchedTx.slice(0, 20).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDateBR(t.payment_date)}</TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell className="text-right font-mono">{formatBRL(Number(t.amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
