import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { Upload, FileCode, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { parseNfeXml, addDays, type NfeData } from "@/lib/nfe";
import {
  categoriesQuery,
  bankAccountsQuery,
  insertRow,
  formatBRL,
  formatDateBR,
} from "@/lib/db";

export const Route = createFileRoute("/_authenticated/financeiro/importar-nfe")({
  ssr: false,
  head: () => ({ meta: [{ title: "Importar NF-e — SuaEmpresa Gestão" }] }),
  component: ImportarNfePage,
});

function ImportarNfePage() {
  const { companyId } = useCurrentCompany();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery(categoriesQuery(companyId));
  const { data: bankAccounts = [] } = useQuery(bankAccountsQuery(companyId));
  const fileRef = useRef<HTMLInputElement>(null);
  const [nfe, setNfe] = useState<NfeData | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("boleto");
  const [categoryId, setCategoryId] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [notes, setNotes] = useState("");

  const expenseCats = categories.filter((c) => c.type === "despesa");

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const data = parseNfeXml(text);
      setNfe(data);
      setDescription(`NF-e ${data.nNF} - ${data.emitNome}`);
      setAmount(String(data.vNF));
      setDueDate(addDays(data.dhEmi, 30));
      setNotes(`CNPJ Fornecedor: ${data.emitCNPJ}`);
      toast.success(`NF-e nº ${data.nNF} carregada`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao ler XML");
    }
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId || !nfe) throw new Error("Dados incompletos");
      const id = crypto.randomUUID();
      await insertRow("transactions", {
        id,
        company_id: companyId,
        type: "despesa",
        status: "pendente",
        description,
        amount: Number(amount),
        due_date: dueDate,
        payment_method: paymentMethod,
        category_id: categoryId || null,
        bank_account_id: bankAccountId || null,
        notes,
      } as any);
      return id;
    },
    onSuccess: async () => {
      toast.success("Lançamento criado a partir da NF-e");
      await qc.invalidateQueries({ queryKey: ["transactions"] });
      navigate({ to: "/financeiro/transacoes" });
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao criar lançamento"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Importar NF-e (XML)"
        description="Faça upload do XML da nota fiscal e crie o lançamento de despesa"
      />

      {!nfe && (
        <Card>
          <CardContent className="p-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${
                dragOver ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <FileCode className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Arraste o arquivo .xml aqui ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">Padrão NF-e 4.0</p>
              <input
                ref={fileRef}
                type="file"
                accept=".xml,text/xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {nfe && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                NF-e nº {nfe.nNF} — {nfe.emitNome}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-3">
                Data: {formatDateBR(nfe.dhEmi?.slice(0, 10))} | Valor: {formatBRL(nfe.vNF)} | CNPJ: {nfe.emitCNPJ}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Vlr Unit</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nfe.items.map((it, i) => (
                    <TableRow key={i}>
                      <TableCell>{it.xProd}</TableCell>
                      <TableCell className="text-right">{it.qCom}</TableCell>
                      <TableCell className="text-right">{formatBRL(it.vUnCom)}</TableCell>
                      <TableCell className="text-right">{formatBRL(it.vProd)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Criar Lançamento (Despesa)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1 md:col-span-2">
                  <Label>Descrição</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Vencimento</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Forma de pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boleto">Boleto</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {expenseCats.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Conta bancária</Label>
                  <Select value={bankAccountId} onValueChange={setBankAccountId}>
                    <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Observações</Label>
                  <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  {create.isPending ? "Criando..." : "Criar lançamento"}
                </Button>
                <Button variant="ghost" onClick={() => setNfe(null)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
