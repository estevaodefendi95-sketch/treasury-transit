import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAppStore, type Cliente } from "@/store/useStore";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendas/clientes")({
  head: () => ({ meta: [{ title: "Clientes — SuaEmpresa Gestão" }] }),
  component: ClientesPage,
});

function ClientesPage() {
  const { clientes, addCliente } = useAppStore();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Cliente>>({});
  const [q, setQ] = useState("");

  const filtered = clientes.filter((c) => c.nome.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${clientes.length} cliente(s) cadastrado(s)`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo cliente</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-4 py-2">
                <div className="space-y-2 col-span-2"><Label>Nome</Label><Input value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-2"><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
                <div className="space-y-2"><Label>CPF/CNPJ</Label><Input value={form.documento ?? ""} onChange={(e) => setForm({ ...form, documento: e.target.value })} /></div>
                <div className="space-y-2"><Label>Cidade</Label><Input value={form.cidade ?? ""} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={() => {
                  if (!form.nome) return toast.error("Informe o nome.");
                  addCliente({ id: crypto.randomUUID(), nome: form.nome, email: form.email, telefone: form.telefone, documento: form.documento, cidade: form.cidade });
                  toast.success("Cliente cadastrado!");
                  setOpen(false); setForm({});
                }}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <Card className="mb-4">
        <CardContent className="pt-6">
          <Input placeholder="Buscar por nome..." value={q} onChange={(e) => setQ(e.target.value)} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead>Cidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.email ?? "-"}</TableCell>
                  <TableCell>{c.telefone ?? "-"}</TableCell>
                  <TableCell>{c.documento ?? "-"}</TableCell>
                  <TableCell>{c.cidade ?? "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
