import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, UserPlus, Building2, Users, Activity } from "lucide-react";
import { toast } from "sonner";
import {
  getCompanyDetail, updateCompany, inviteCompanyUser,
} from "@/lib/master.functions";
import {
  getAccessToken, PLAN_OPTIONS, SEGMENT_OPTIONS, STATUS_LABEL, STATUS_BADGE, formatCompanyDateBR,
} from "@/lib/master";
import {
  ROLE_OPTIONS, ROLE_LABEL, ROLE_BADGE, STATUS_LABEL as USER_STATUS_LABEL,
  STATUS_BADGE as USER_STATUS_BADGE, formatDateTimeBR, type Role, type UserStatus,
} from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/master/empresas/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Empresa — Super Admin" }] }),
  component: EmpresaDetailPage,
});

type CompanyRow = Record<string, string | null>;

function EmpresaDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const detailFn = useServerFn(getCompanyDetail);

  const detailQ = useQuery({
    queryKey: ["master", "company", id],
    queryFn: async () => detailFn({ data: { token: await getAccessToken(), id } }),
  });

  const company = (detailQ.data?.company ?? null) as CompanyRow | null;
  const users = detailQ.data?.users ?? [];
  const stats = detailQ.data?.stats;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["master", "company", id] });

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/master/empresas"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
        </Button>
        <PageHeader
          title={company?.name ?? "Empresa"}
          description={company?.cnpj ?? undefined}
          actions={
            company?.status ? (
              <Badge variant="outline" className={STATUS_BADGE[company.status] ?? ""}>
                {STATUS_LABEL[company.status] ?? company.status}
              </Badge>
            ) : null
          }
        />
      </div>

      {detailQ.isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : detailQ.isError ? (
        <div className="py-12 text-center text-sm text-destructive">{(detailQ.error as Error).message}</div>
      ) : !company ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Empresa não encontrada.</div>
      ) : (
        <Tabs defaultValue="info">
          <TabsList>
            <TabsTrigger value="info"><Building2 className="h-4 w-4 mr-1" /> Informações</TabsTrigger>
            <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" /> Usuários</TabsTrigger>
            <TabsTrigger value="whitelabel">White Label</TabsTrigger>
            <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-1" /> Atividade</TabsTrigger>
          </TabsList>

          <TabsContent value="info"><InfoTab id={id} company={company} onSaved={invalidate} /></TabsContent>
          <TabsContent value="users"><UsersTab id={id} users={users} onChanged={invalidate} /></TabsContent>
          <TabsContent value="whitelabel"><WhiteLabelTab id={id} company={company} onSaved={invalidate} /></TabsContent>
          <TabsContent value="activity"><ActivityTab company={company} stats={stats} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ---------- Tab 1: Informações ----------
function InfoTab({ id, company, onSaved }: { id: string; company: CompanyRow; onSaved: () => void }) {
  const updateFn = useServerFn(updateCompany);
  const [f, setF] = useState({
    name: company.name ?? "", cnpj: company.cnpj ?? "", email: company.email ?? "",
    phone: company.phone ?? "", segment: company.segment ?? "", plan: company.plan ?? "free",
    status: company.status ?? "trial",
  });
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const mut = useMutation({
    mutationFn: async () =>
      updateFn({ data: { token: await getAccessToken(), id, fields: f } }),
    onSuccess: () => { toast.success("Empresa atualizada"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Informações da empresa</CardTitle></CardHeader>
      <CardContent className="grid sm:grid-cols-2 gap-4">
        <Fld label="Nome"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Fld>
        <Fld label="CNPJ"><Input value={f.cnpj} onChange={(e) => set("cnpj", e.target.value)} /></Fld>
        <Fld label="E-mail"><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></Fld>
        <Fld label="Telefone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Fld>
        <Fld label="Segmento">
          <Select value={f.segment} onValueChange={(v) => set("segment", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{SEGMENT_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Fld>
        <Fld label="Plano">
          <Select value={f.plan} onValueChange={(v) => set("plan", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PLAN_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </Fld>
        <Fld label="Status">
          <Select value={f.status} onValueChange={(v) => set("status", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativa">Ativa</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="suspensa">Suspensa</SelectItem>
            </SelectContent>
          </Select>
        </Fld>
        <div className="sm:col-span-2">
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Tab 2: Usuários ----------
function UsersTab({ id, users, onChanged }: { id: string; users: CompanyRow[]; onChanged: () => void }) {
  const inviteFn = useServerFn(inviteCompanyUser);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("financeiro");

  const mut = useMutation({
    mutationFn: async () =>
      inviteFn({ data: { token: await getAccessToken(), id, full_name: name, email, role } }),
    onSuccess: () => {
      toast.success(`Convite enviado para ${email}`);
      setOpen(false); setName(""); setEmail(""); setRole("financeiro");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Usuários ({users.length})</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Convidar</Button>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Nenhum usuário.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Último acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const r = (u.role as Role) ?? "vendas";
                const st = (u.status as UserStatus) ?? "ativo";
                return (
                  <TableRow key={u.id as string}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className={ROLE_BADGE[r] ?? ""}>{ROLE_LABEL[r] ?? r}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className={USER_STATUS_BADGE[st] ?? ""}>{USER_STATUS_LABEL[st] ?? st}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTimeBR(u.last_seen_at as string)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Fld label="Nome completo"><Input value={name} onChange={(e) => setName(e.target.value)} /></Fld>
            <Fld label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Fld>
            <Fld label="Função">
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </Fld>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => mut.mutate()} disabled={!name.trim() || !email.trim() || mut.isPending}>
              {mut.isPending ? "Enviando…" : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------- Tab 3: White Label ----------
function WhiteLabelTab({ id, company, onSaved }: { id: string; company: CompanyRow; onSaved: () => void }) {
  const updateFn = useServerFn(updateCompany);
  const [logoUrl, setLogoUrl] = useState(company.logo_url ?? "");
  // Cor e nome do app são pré-visualização local — exigem colunas próprias para persistir.
  const [color, setColor] = useState("#4f46e5");
  const [appName, setAppName] = useState(company.name ?? "");

  useEffect(() => { setLogoUrl(company.logo_url ?? ""); }, [company.logo_url]);

  const mut = useMutation({
    mutationFn: async () =>
      updateFn({ data: { token: await getAccessToken(), id, fields: { logo_url: logoUrl || null } } }),
    onSuccess: () => { toast.success("Logo salva"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">White Label</CardTitle></CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        <Fld label="URL da logo">
          <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…/logo.png" />
        </Fld>
        {logoUrl && (
          <div className="rounded-lg border p-4 flex items-center gap-3" style={{ borderColor: color }}>
            <img src={logoUrl} alt="logo" className="h-10 w-10 rounded object-contain" />
            <span className="font-semibold" style={{ color }}>{appName || "SuaEmpresa"}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Fld label="Cor primária">
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 rounded border" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </Fld>
          <Fld label="Nome do app"><Input value={appName} onChange={(e) => setAppName(e.target.value)} /></Fld>
        </div>
        <p className="text-xs text-muted-foreground">
          A logo é persistida (campo <code>logo_url</code>). Cor primária e nome do app são
          pré-visualização — para salvá-los, adicione colunas <code>primary_color</code> e{" "}
          <code>app_name</code> à tabela <code>companies</code>.
        </p>
        <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? "Salvando…" : "Salvar logo"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------- Tab 4: Atividade ----------
function ActivityTab({ company, stats }: { company: CompanyRow; stats?: { usersCount: number; transactionsCount: number } }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Usuários" value={stats?.usersCount ?? 0} />
        <Stat label="Lançamentos" value={stats?.transactionsCount ?? 0} />
        <Stat label="Plano" value={company.plan ?? "—"} />
        <Stat label="Criada em" value={formatCompanyDateBR(company.created_at)} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Atividade recente</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          O registro detalhado de auditoria (logins, alterações) requer uma tabela de
          <code> activity_logs</code>. Os números acima refletem o estado atual da empresa.
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </CardContent></Card>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
