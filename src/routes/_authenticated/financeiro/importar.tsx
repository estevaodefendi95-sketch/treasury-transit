import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, CheckCircle2, Loader2, Link2, Plus, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import {
  transactionsQuery, nameRulesQuery, bankAccountsQuery, categoriesQuery,
  insertRow, applyNameRules, formatBRL, formatDateBR,
  type Transaction, type NameRule,
} from "@/lib/db";
import { approvalLimitsQuery, computeApprovalStatus, notifyAdminsPendingApproval } from "@/lib/approvals";
import { Input } from "@/components/ui/input";
import { parseOfx, type OfxRow } from "@/lib/ofx";
import { extractPdfText } from "@/lib/pdf";
import { parsePdfStatement } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/financeiro/importar")({
  ssr: false,
  head: () => ({ meta: [{ title: "Importar Extrato — SuaEmpresa Gestão" }] }),
  component: ImportarPage,
});

type Row = OfxRow & { selected: boolean; appliedRule?: NameRule | null; originalDescription: string };
type MatchAction = "link" | "create" | "ignore";
type Match = {
  row: Row;
  candidateId: string | null;
  confidence: number; // 0..1
  action: MatchAction;
  editedDescription: string;
  categoryId: string | null;
};

const STEPS = ["Upload", "Revisar", "Conciliar", "Concluído"];

function ImportarPage() {
  const { companyId, profile, user } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: transacoes = [] } = useQuery(transactionsQuery(companyId));
  const { data: nameRules = [] } = useQuery(nameRulesQuery(companyId));
  const { data: bankAccounts = [] } = useQuery(bankAccountsQuery(companyId));
  const { data: categorias = [] } = useQuery(categoriesQuery(companyId));
  const { data: approvalLimits = [] } = useQuery(approvalLimitsQuery(companyId));
  const parsePdf = useServerFn(parsePdfStatement);

  const [step, setStep] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [filename, setFilename] = useState("");
  const [importType, setImportType] = useState<"ofx" | "pdf">("ofx");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [summary, setSummary] = useState({ linked: 0, created: 0, ignored: 0 });

  const reset = () => {
    setStep(1); setRows([]); setMatches([]); setFilename("");
    setSummary({ linked: 0, created: 0, ignored: 0 });
  };

  const onFile = async (file: File) => {
    setFilename(file.name);
    setAnalyzing(true);
    try {
      const lower = file.name.toLowerCase();
      let parsed: OfxRow[] = [];
      if (lower.endsWith(".ofx") || lower.endsWith(".qfx")) {
        setImportType("ofx");
        const text = await file.text();
        parsed = parseOfx(text);
      } else if (lower.endsWith(".pdf")) {
        setImportType("pdf");
        toast.info("Extraindo texto do PDF...");
        const text = await extractPdfText(file);
        toast.info("Analisando com IA...");
        const aiRows = await parsePdf({ data: { text } });
        parsed = aiRows.map((r: { date: string; description: string; amount: number; type: "credito" | "debito" }) => ({
          fitid: crypto.randomUUID(),
          date: r.date,
          description: r.description,
          amount: Math.abs(Number(r.amount)),
          type: r.type,
        }));
      } else {
        toast.error("Arquivo deve ser .ofx, .qfx ou .pdf");
        return;
      }
      if (parsed.length === 0) {
        toast.error("Nenhuma transação encontrada");
        return;
      }
      const enriched: Row[] = parsed.map((p) => {
        const applied = applyNameRules(p.description, nameRules);
        return {
          ...p,
          description: applied.matched ? applied.name : p.description,
          originalDescription: p.description,
          appliedRule: applied.matched,
          selected: true,
        };
      });
      setRows(enriched);
      setStep(2);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao processar arquivo";
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  // Matching no passo 3
  const buildMatches = () => {
    const selected = rows.filter((r) => r.selected);
    const result: Match[] = selected.map((row) => {
      let best: { tx: Transaction; score: number } | null = null;
      const rowAmount = Number(row.amount.toFixed(2));
      const rowDate = new Date(row.date);
      for (const tx of transacoes) {
        if (tx.payment_date) continue; // já quitada
        const txAmount = Number(Number(tx.amount).toFixed(2));
        if (Math.abs(txAmount - rowAmount) > 0.01) continue;
        const txDate = new Date(tx.due_date);
        const diffDays = Math.abs((txDate.getTime() - rowDate.getTime()) / 86400000);
        if (diffDays > 3) continue;
        let score = 0.5; // match valor+data
        score += (3 - diffDays) / 6; // até +0.5
        const a = row.description.toLowerCase();
        const b = tx.description.toLowerCase();
        const tokens = a.split(/\s+/).filter((t) => t.length > 3);
        const hits = tokens.filter((t) => b.includes(t)).length;
        if (tokens.length > 0) score += (hits / tokens.length) * 0.3;
        if (!best || score > best.score) best = { tx, score };
      }
      const confidence = best ? Math.min(1, best.score) : 0;
      return {
        row,
        candidateId: best?.tx.id ?? null,
        confidence,
        action: best && confidence >= 0.5 ? "link" : "create",
        editedDescription: row.description,
        categoryId: null,
      };
    });
    setMatches(result);
    setStep(3);
  };

  const approveHighConfidence = () => {
    setMatches((m) => m.map((x) => x.confidence >= 0.8 && x.candidateId ? { ...x, action: "link" } : x));
    toast.success("Aprovados de alta confiança");
  };

  const finalize = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      let linked = 0, created = 0, ignored = 0;

      // 1) cria registro de import
      const impRec = await insertRow<{ id: string }>("bank_statement_imports", {
        company_id: companyId,
        bank_account_id: bankAccountId || null,
        filename,
        import_type: importType,
        total_transactions: rows.length,
        matched_transactions: matches.filter((m) => m.action === "link").length,
        status: "completed",
        imported_at: new Date().toISOString(),
      } as unknown as { id: string });

      let pendingApprovals = 0;
      for (const m of matches) {
        if (m.action === "ignore") { ignored++; continue; }
        const descr = m.editedDescription.trim() || m.row.description;

        // Save name rule if user renamed (and didn't already apply an existing rule)
        const renamed =
          descr.toLowerCase() !== m.row.originalDescription.toLowerCase() &&
          !m.row.appliedRule;
        if (renamed) {
          try {
            await insertRow<NameRule>("name_rules", {
              company_id: companyId,
              original_pattern: m.row.originalDescription,
              suggested_name: descr,
              times_applied: 1,
            } as unknown as NameRule);
          } catch {
            /* ignore unique-violation if same rule exists */
          }
        }

        if (m.action === "link" && m.candidateId) {
          await supabase.from("transactions")
            .update({
              description: descr,
              category_id: m.categoryId || null,
              payment_date: m.row.date,
              status: m.row.type === "credito" ? "recebido" : "pago",
              is_reconciled: true,
              bank_statement_import_id: impRec.id,
            })
            .eq("id", m.candidateId);
          linked++;
        } else if (m.action === "create") {
          const amount = Number(m.row.amount);
          const approvalStatus = computeApprovalStatus(amount, profile?.role, approvalLimits);
          const inserted = await insertRow<Transaction>("transactions", {
            company_id: companyId,
            type: m.row.type === "credito" ? "receita" : "despesa",
            status: m.row.type === "credito" ? "recebido" : "pago",
            description: descr,
            amount,
            due_date: m.row.date,
            payment_date: m.row.date,
            bank_account_id: bankAccountId || null,
            category_id: m.categoryId || null,
            is_reconciled: true,
            bank_statement_import_id: impRec.id,
            original_description: m.row.originalDescription,
            approval_status: approvalStatus,
            created_by: user?.id ?? null,
          } as unknown as Transaction);
          created++;
          if (approvalStatus === "aguardando_aprovacao") {
            pendingApprovals++;
            await notifyAdminsPendingApproval({
              companyId,
              transactionId: inserted.id,
              description: descr,
              amount,
              requesterName: profile?.full_name ?? "Usuário",
            });
          }
        }
        // snapshot do extrato
        await insertRow("bank_statements", {
          company_id: companyId,
          bank_account_id: bankAccountId || null,
          date: m.row.date,
          description: descr,
          amount: m.row.amount,
          type: m.row.type,
          is_reconciled: m.action === "link" || m.action === "create",
          transaction_id: m.action === "link" ? m.candidateId : null,
        } as Record<string, unknown>);
      }

      // 2) atualiza saldo da conta bancária
      if (bankAccountId) {
        const delta = matches
          .filter((m) => m.action !== "ignore")
          .reduce((s, m) => s + (m.row.type === "credito" ? m.row.amount : -m.row.amount), 0);
        const acc = bankAccounts.find((a) => a.id === bankAccountId);
        if (acc) {
          await supabase.from("bank_accounts")
            .update({ balance: Number(acc.balance ?? 0) + delta })
            .eq("id", bankAccountId);
        }
      }

      return { linked, created, ignored, pendingApprovals };
    },
    onSuccess: (s) => {
      setSummary({ linked: s.linked, created: s.created, ignored: s.ignored });
      if (s.pendingApprovals > 0) {
        toast.success(`${s.pendingApprovals} lançamento(s) enviados para aprovação`);
      }
      qc.invalidateQueries({ queryKey: ["transactions", companyId] });
      qc.invalidateQueries({ queryKey: ["bank_accounts", companyId] });
      qc.invalidateQueries({ queryKey: ["bank_statements", companyId] });
      setStep(4);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    const credito = rows.filter((r) => r.selected && r.type === "credito").reduce((s, r) => s + r.amount, 0);
    const debito = rows.filter((r) => r.selected && r.type === "debito").reduce((s, r) => s + r.amount, 0);
    return { credito, debito, count: rows.filter((r) => r.selected).length };
  }, [rows]);

  return (
    <div className="space-y-6">
      <PageHeader title="Importar Extrato" description="OFX/QFX ou PDF — com conciliação inteligente." />

      {/* Stepper */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            {STEPS.map((label, i) => {
              const n = i + 1;
              return (
                <div key={label} className="flex items-center flex-1">
                  <div className={cn(
                    "flex items-center gap-2 shrink-0",
                    step === n ? "text-primary" : step > n ? "text-emerald-600" : "text-muted-foreground",
                  )}>
                    <div className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center font-semibold border-2",
                      step === n && "border-primary bg-primary/10",
                      step > n && "border-emerald-600 bg-emerald-600 text-white",
                      step < n && "border-border",
                    )}>
                      {step > n ? <CheckCircle2 className="h-4 w-4" /> : n}
                    </div>
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={cn("flex-1 h-0.5 mx-2", step > n ? "bg-emerald-600" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 1 */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upload do arquivo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {bankAccounts.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Conta bancária (opcional)</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                >
                  <option value="">— Selecione —</option>
                  {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <label
              className="border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center gap-2 cursor-pointer hover:border-primary transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) onFile(f);
              }}
            >
              {analyzing ? (
                <><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="text-sm">Analisando com IA...</p></>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm font-medium">Arraste ou clique para selecionar</p>
                  <p className="text-xs text-muted-foreground">Formatos: .ofx, .qfx, .pdf</p>
                </>
              )}
              <input type="file" accept=".ofx,.qfx,.pdf" className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          </CardContent>
        </Card>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revisar {rows.length} transação(ões) de "{filename}"</CardTitle>
            <div className="flex gap-4 text-sm pt-2">
              <Badge variant="outline">{totals.count} selecionada(s)</Badge>
              <span className="text-emerald-600">Créditos: {formatBRL(totals.credito)}</span>
              <span className="text-rose-600">Débitos: {formatBRL(totals.debito)}</span>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={r.fitid}>
                    <TableCell>
                      <Checkbox checked={r.selected}
                        onCheckedChange={(v) => {
                          const copy = [...rows]; copy[i] = { ...copy[i], selected: !!v }; setRows(copy);
                        }} />
                    </TableCell>
                    <TableCell>{formatDateBR(r.date)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.description}</div>
                      {r.appliedRule && (
                        <Badge variant="outline" className="mt-1 bg-yellow-50 border-yellow-300 text-yellow-700 text-[10px]">
                          Regra aplicada
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className={cn("text-right font-mono",
                      r.type === "credito" ? "text-emerald-600" : "text-rose-600")}>
                      {r.type === "credito" ? "+" : "-"} {formatBRL(r.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={buildMatches} disabled={totals.count === 0}>Continuar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="text-base">Conciliar com transações existentes</CardTitle>
              <Button variant="outline" size="sm" onClick={approveHighConfidence}>
                Aprovar todos de Alta confiança
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Edite o nome da movimentação (salva regra para próximas importações) e selecione a categoria. Depois envie para aprovação.
            </p>
            {matches.map((m, i) => {
              const candidate = transacoes.find((t) => t.id === m.candidateId);
              const tier = m.confidence >= 0.8 ? "Alta" : m.confidence >= 0.5 ? "Média" : "Baixa";
              const tierColor = m.confidence >= 0.8 ? "bg-emerald-100 text-emerald-700"
                : m.confidence >= 0.5 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
              const isIncome = m.row.type === "credito";
              const cats = categorias.filter((c) => (c.type ?? "despesa") === (isIncome ? "receita" : "despesa"));
              const renamed =
                m.editedDescription.trim().toLowerCase() !==
                m.row.originalDescription.toLowerCase();
              return (
                <div key={i} className="border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Extrato original</div>
                      <div className="text-xs text-muted-foreground truncate">{m.row.originalDescription}</div>
                      <div className="text-xs mt-0.5">
                        {formatDateBR(m.row.date)} ·{" "}
                        <span className={isIncome ? "text-emerald-600" : "text-rose-600"}>
                          {isIncome ? "+" : "-"}{formatBRL(m.row.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("text-[10px]", tierColor)}>{tier} {Math.round(m.confidence * 100)}%</Badge>
                      <div className="flex gap-1">
                        <Button size="sm" variant={m.action === "link" ? "default" : "outline"} className="h-7 px-2"
                          disabled={!m.candidateId} title="Vincular a lançamento existente"
                          onClick={() => setMatches((arr) => arr.map((x, j) => j === i ? { ...x, action: "link" } : x))}>
                          <Link2 className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant={m.action === "create" ? "default" : "outline"} className="h-7 px-2"
                          title="Criar novo lançamento"
                          onClick={() => setMatches((arr) => arr.map((x, j) => j === i ? { ...x, action: "create" } : x))}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant={m.action === "ignore" ? "default" : "outline"} className="h-7 px-2"
                          title="Ignorar"
                          onClick={() => setMatches((arr) => arr.map((x, j) => j === i ? { ...x, action: "ignore" } : x))}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {m.action !== "ignore" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                          <Pencil className="h-3 w-3" /> Descrição
                          {renamed && (
                            <span className="text-[10px] text-amber-600">(regra será salva)</span>
                          )}
                        </label>
                        <Input
                          value={m.editedDescription}
                          onChange={(e) =>
                            setMatches((arr) => arr.map((x, j) =>
                              j === i ? { ...x, editedDescription: e.target.value } : x))
                          }
                          placeholder="Nome da movimentação"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Categoria
                        </label>
                        <select
                          className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                          value={m.categoryId ?? ""}
                          onChange={(e) =>
                            setMatches((arr) => arr.map((x, j) =>
                              j === i ? { ...x, categoryId: e.target.value || null } : x))
                          }
                        >
                          <option value="">— Sem categoria —</option>
                          {cats.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {m.action === "link" && candidate && (
                    <div className="text-xs text-muted-foreground border-t pt-2">
                      Vinculando a: <span className="font-medium text-foreground">{candidate.description}</span>
                      {" · "}{formatDateBR(candidate.due_date)} · {formatBRL(Number(candidate.amount))}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button onClick={() => finalize.mutate()} disabled={finalize.isPending}>
                {finalize.isPending ? "Salvando..." : "Enviar para aprovação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}



      {/* Step 4 */}
      {step === 4 && (
        <Card>
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto" />
            <h2 className="text-2xl font-semibold">Importação concluída</h2>
            <div className="flex justify-center gap-8 text-sm pt-4">
              <div><div className="text-2xl font-bold text-primary">{summary.linked}</div><div className="text-muted-foreground">Vinculadas</div></div>
              <div><div className="text-2xl font-bold text-emerald-600">{summary.created}</div><div className="text-muted-foreground">Criadas</div></div>
              <div><div className="text-2xl font-bold text-slate-500">{summary.ignored}</div><div className="text-muted-foreground">Ignoradas</div></div>
            </div>
            <Button onClick={reset}><FileText className="h-4 w-4 mr-1" />Nova importação</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
