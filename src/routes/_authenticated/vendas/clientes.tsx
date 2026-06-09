import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { customersQuery, insertRow, type Customer } from "@/lib/db";

export const Route = createFileRoute("/_authenticated/vendas/clientes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Clientes — SuaEmpresa Gestão" }] }),
  component: ClientesPage,
});

function ClientesPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: clientes = [] } = useQuery(customersQuery(companyId));
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", cpf_cnpj: "", city: "" });

  const filtered = clientes.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()));

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      return insertRow<Customer>("customers", {
        company_id: companyId,
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        cpf_cnpj: form.cpf_cnpj || null,
        city: form.city || null,
        is_active: true,
      } as unknown as Customer);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", companyId] });
      toast.success("Cliente criado");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", cpf_cnpj: "", city: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description={`${clientes.length} cadastrado(s).`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Novo cliente</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome / Razão social</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>CPF / CNPJ</Label>
                    <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                  </div>
                </div>
                <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name} className="w-full">
                  {create.isPending ? "Salvando..." : "Criar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar..." value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Cidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Nenhum cliente</TableCell></TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.city ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
