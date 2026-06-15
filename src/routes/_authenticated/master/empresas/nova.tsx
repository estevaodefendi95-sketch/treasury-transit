import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { createCompanyWithAdmin } from "@/lib/master.functions";
import { getAccessToken, PLAN_OPTIONS, SEGMENT_OPTIONS } from "@/lib/master";

export const Route = createFileRoute("/_authenticated/master/empresas/nova")({
  ssr: false,
  head: () => ({ meta: [{ title: "Nova Empresa — Super Admin" }] }),
  component: NovaEmpresaPage,
});

function NovaEmpresaPage() {
  const createFn = useServerFn(createCompanyWithAdmin);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "", cnpj: "", email: "", phone: "", segment: "", plan: "free",
    admin_name: "", admin_email: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const [done, setDone] = useState<{ adminEmail: string } | null>(null);

  const mut = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      return createFn({ data: { token, ...form } });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["master"] });
      setDone({ adminEmail: res.adminEmail });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = form.name.trim() && form.admin_name.trim() && form.admin_email.trim();

  if (done) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto" />
        <h2 className="text-2xl font-bold">Empresa criada!</h2>
        <p className="text-muted-foreground">
          Um convite foi enviado para <span className="font-medium">{done.adminEmail}</span>.
          O administrador receberá um e-mail para definir a senha e acessar o sistema.
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <Button variant="outline" onClick={() => { setDone(null); setForm({ name: "", cnpj: "", email: "", phone: "", segment: "", plan: "free", admin_name: "", admin_email: "" }); }}>
            Criar outra
          </Button>
          <Button onClick={() => navigate({ to: "/master/empresas" })}>Ver empresas</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/master/empresas"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        </Button>
        <PageHeader title="Nova Empresa" description="Cadastre a empresa e convide o administrador." />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados da empresa</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="Nome *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="CNPJ"><Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" /></Field>
          <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Telefone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 00000-0000" /></Field>
          <Field label="Segmento">
            <Select value={form.segment} onValueChange={(v) => set("segment", v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {SEGMENT_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Plano">
            <Select value={form.plan} onValueChange={(v) => set("plan", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Administrador</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <Field label="Nome do admin *"><Input value={form.admin_name} onChange={(e) => set("admin_name", e.target.value)} /></Field>
          <Field label="E-mail do admin *"><Input type="email" value={form.admin_email} onChange={(e) => set("admin_email", e.target.value)} placeholder="admin@empresa.com.br" /></Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline"><Link to="/master/empresas">Cancelar</Link></Button>
        <Button onClick={() => mut.mutate()} disabled={!canSubmit || mut.isPending}>
          {mut.isPending ? "Criando…" : "Criar empresa e convidar admin"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
