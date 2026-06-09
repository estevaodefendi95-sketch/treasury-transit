import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { formatBRL } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import {
  approvalLimitsQuery,
  DEFAULT_LIMITS,
  ROLE_LABEL,
  type ApprovalLimit,
} from "@/lib/approvals";

export const Route = createFileRoute("/_authenticated/configuracoes/aprovacoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Limites de Aprovação" }] }),
  component: AprovacoesConfigPage,
});

function AprovacoesConfigPage() {
  const { companyId, profile } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: limits = [] } = useQuery(approvalLimitsQuery(companyId));
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  // Seed defaults if missing
  useEffect(() => {
    if (!companyId) return;
    const missing = DEFAULT_LIMITS.filter((d) => !limits.find((l) => l.role === d.role));
    if (missing.length === 0) return;
    void (async () => {
      const rows = missing.map((m) => ({
        company_id: companyId,
        role: m.role,
        max_amount: m.max_amount,
      }));
      await supabase.from("approval_limits").insert(rows);
      qc.invalidateQueries({ queryKey: ["approval_limits", companyId] });
    })();
  }, [companyId, limits, qc]);

  const save = useMutation({
    mutationFn: async ({ id, max_amount }: { id: string; max_amount: number }) => {
      const { error } = await supabase
        .from("approval_limits")
        .update({ max_amount })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["approval_limits", companyId] });
      toast.success("Limite atualizado");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isAdmin = profile?.role === "admin";

  // Order: admin → financeiro → vendas → estoque
  const order: Record<string, number> = { admin: 0, financeiro: 1, vendas: 2, estoque: 3 };
  const sorted = [...limits].sort((a, b) => (order[a.role] ?? 99) - (order[b.role] ?? 99));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Limites de Aprovação"
        description="Defina o valor máximo que cada perfil pode lançar sem aprovação de um administrador."
      />

      {!isAdmin && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="pt-6 flex items-center gap-3 text-amber-800">
            <ShieldAlert className="h-5 w-5" />
            <div className="text-sm">
              Você não tem permissão para alterar os limites. Apenas administradores podem editar.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por perfil</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-right">Limite máximo sem aprovação</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-6">
                    Configurando limites padrão…
                  </TableCell>
                </TableRow>
              )}
              {sorted.map((l: ApprovalLimit) => {
                const isEditing = editing === l.id;
                const unlimited = Number(l.max_amount) >= 999_000_000;
                return (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{ROLE_LABEL[l.role] ?? l.role}</div>
                      <div className="text-xs text-muted-foreground">{l.role}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {isEditing ? (
                        <Input
                          autoFocus
                          className="h-8 text-right inline-block w-40"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          placeholder="0,00"
                        />
                      ) : unlimited ? (
                        <span className="text-emerald-600 font-semibold">Sem limite</span>
                      ) : (
                        formatBRL(Number(l.max_amount))
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && !isEditing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing(l.id);
                            setDraft(String(l.max_amount));
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {isEditing && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              save.mutate({
                                id: l.id,
                                max_amount: Number(draft.replace(",", ".")) || 0,
                              })
                            }
                          >
                            <Check className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="text-xs text-muted-foreground mt-4">
            Lançamentos com valor acima do limite do perfil entram na fila de aprovação automaticamente.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
