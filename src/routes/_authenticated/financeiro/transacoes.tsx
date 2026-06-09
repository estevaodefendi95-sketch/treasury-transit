import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore, formatBRL, formatDateBR, type Transacao } from "@/store/useStore";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/financeiro/transacoes")({
  head: () => ({ meta: [{ title: "Transações — SuaEmpresa Gestão" }] }),
  component: TransacoesPage,
});

function TransacoesPage() {
  const { transacoes, addTransacao } = useAppStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"todas" | "receita" | "despesa">("todas");

  const [form, setForm] = useState<Partial<Transacao>>({ tipo: "receita", status: "pendente", data: new Date().toISOString().slice(0, 10) });

  const filtered = transacoes.filter((t) => filter === "todas" || t.tipo === filter);

  const handleSave = () => {
    if (!form.descricao || !form.valor) {
      toast.error("Preencha descrição e valor.");
      return;
    }
    addTransacao({
      id: crypto.randomUUID(),
      data: form.data ?? new Date().toISOString().slice(0, 10),
      descricao: form.descricao,
      categoria: form.categoria ?? "Outros",
      tipo: form.tipo as "receita" | "despesa",
      valor: Number(form.valor),
      conta: form.conta,
      status: form.status as Transacao["status"],
    });
    toast.success("Transação registrada!");
    setOpen(false);
    setForm({ tipo: "receita", status: "pendente", data: new Date().toISOString().slice(0, 10) });
  };

  return (
    <>
      <PageHeader
        title="Transações"
        description="Histórico de movimentações financeiras."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nova transação</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova transação</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-2">
                <div className="space-y-2 col-span-2">
                  <Label>Descrição</Label>
                  <Input value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as "receita" | "despesa" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={form.valor ?? ""} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input type="date" value={form.data ?? ""} onChange={(e) => setForm({ ...form, data: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Input value={form.categoria ?? ""} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Conta bancária</Label>
                  <Input value={form.conta ?? ""} onChange={(e) => setForm({ ...form, conta: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <Card className="mb-4">
        <CardContent className="pt-6 flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-2">Filtrar:</span>
          {(["todas", "receita", "despesa"] as const).map((f) => (
            <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
              {f === "todas" ? "Todas" : f === "receita" ? "Receitas" : "Despesas"}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDateBR(t.data)}</TableCell>
                  <TableCell className="font-medium">{t.descricao}</TableCell>
                  <TableCell>{t.categoria}</TableCell>
                  <TableCell>{t.conta ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={t.status === "pendente" ? "secondary" : "default"}>{t.status}</Badge>
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${t.tipo === "receita" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {t.tipo === "receita" ? "+" : "-"} {formatBRL(t.valor)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
