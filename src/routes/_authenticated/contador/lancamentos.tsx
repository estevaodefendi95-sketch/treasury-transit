import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { transactionsQuery, formatBRL, formatDateBR } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/contador/lancamentos")({
  ssr: false,
  head: () => ({ meta: [{ title: "Lançamentos — Contador" }] }),
  component: ContadorLancamentos,
});

function ContadorLancamentos() {
  const { companyId } = useCurrentCompany();
  const { data: tx = [] } = useQuery(transactionsQuery(companyId));
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return tx.filter((t) => !q || t.description.toLowerCase().includes(q));
  }, [tx, search]);

  return (
    <div className="space-y-4">
      <PageHeader title="Lançamentos" description="Somente leitura" />
      <Card>
        <CardContent className="p-4 space-y-3">
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum lançamento encontrado</TableCell></TableRow>
              )}
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDateBR(t.due_date)}</TableCell>
                  <TableCell>{t.description}</TableCell>
                  <TableCell><Badge variant={t.type === "receita" ? "default" : "secondary"}>{t.type === "receita" ? "Receita" : "Despesa"}</Badge></TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell className="text-right font-medium">{formatBRL(Number(t.amount))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
