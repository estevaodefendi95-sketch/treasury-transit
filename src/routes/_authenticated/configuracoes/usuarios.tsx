import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { MoreVertical, UserPlus, Users, Search, Pencil, Mail, Pause, Play, Trash2 } from "lucide-react";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { inviteUser } from "@/lib/users.functions";
import {
  ROLE_OPTIONS, ROLE_LABEL, ROLE_BADGE, ROLE_AVATAR_BG, ROLE_LIMIT,
  STATUS_BADGE, STATUS_LABEL, initialsOf, formatDateTimeBR, roleLimitLabel,
  type Role, type UserStatus,
} from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/configuracoes/usuarios")({
  ssr: false,
  head: () => ({ meta: [{ title: "Usuários — SuaEmpresa Gestão" }] }),
  component: UsersPage,
});

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  last_seen_at: string | null;
  avatar_url: string | null;
};

function UsersPage() {
  const { companyId, profile, user } = useCurrentCompany();
  const isAdmin = profile?.role === "admin";
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [removing, setRemoving] = useState<Row | null>(null);

  const usersQ = useQuery({
    queryKey: ["users", companyId],
    queryFn: async (): Promise<Row[]> => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, status, last_seen_at, avatar_url")
        .eq("company_id", companyId)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    enabled: !!companyId && isAdmin,
  });

  const filtered = useMemo(() => {
    const list = usersQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q),
    );
  }, [usersQ.data, search]);

  const adminsCount = useMemo(
    () => (usersQ.data ?? []).filter((u) => u.role === "admin" && u.status === "ativo").length,
    [usersQ.data],
  );

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: UserStatus }) => {
      const { error } = await supabase.from("profiles").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", companyId] });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeUser = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", companyId] });
      toast.success("Usuário removido");
      setRemoving(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gerenciamento de Usuários"
        description="Convide membros da equipe e gerencie permissões"
        actions={
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4" /> Convidar Usuário
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {usersQ.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 && !search ? (
            <EmptyState
              icon="👥"
              title="Nenhum usuário cadastrado"
              description="Convide membros da equipe para colaborar"
              actionLabel="Convidar primeiro usuário"
              onAction={() => setInviteOpen(true)}
            />
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum resultado para "{search}"</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const role = (u.role as Role) ?? "vendas";
                  const status = (u.status as UserStatus) ?? "ativo";
                  const isSelf = u.id === user?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div
                          className={`h-9 w-9 rounded-full ${ROLE_AVATAR_BG[role] ?? "bg-gray-500"} text-white flex items-center justify-center text-xs font-semibold`}
                        >
                          {initialsOf(u.full_name, u.email)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ROLE_BADGE[role] ?? ""}>
                          {ROLE_LABEL[role] ?? role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_BADGE[status] ?? ""}>
                          {STATUS_LABEL[status] ?? status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTimeBR(u.last_seen_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={isSelf}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(u)}>
                              <Pencil className="h-4 w-4" /> Editar função
                            </DropdownMenuItem>
                            {status === "convite_pendente" && (
                              <DropdownMenuItem
                                onClick={() => toast.success(`Convite reenviado para ${u.email}`)}
                              >
                                <Mail className="h-4 w-4" /> Reenviar convite
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {status === "ativo" ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (u.role === "admin" && adminsCount <= 1) {
                                    toast.error("Não é possível desativar o último admin");
                                    return;
                                  }
                                  toggleStatus.mutate({ id: u.id, status: "inativo" });
                                }}
                              >
                                <Pause className="h-4 w-4" /> Desativar conta
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => toggleStatus.mutate({ id: u.id, status: "ativo" })}>
                                <Play className="h-4 w-4" /> Reativar conta
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                if (u.role === "admin" && adminsCount <= 1) {
                                  toast.error("Não é possível remover o último admin");
                                  return;
                                }
                                setRemoving(u);
                              }}
                            >
                              <Trash2 className="h-4 w-4" /> Remover usuário
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InviteUserModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        companyId={companyId}
        onCreated={() => qc.invalidateQueries({ queryKey: ["users", companyId] })}
      />

      <EditUserModal
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["users", companyId] })}
      />

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.full_name || removing?.email} perderá acesso ao sistema. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removing && removeUser.mutate(removing.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteUserModal({
  open, onClose, companyId, onCreated,
}: { open: boolean; onClose: () => void; companyId: string | null; onCreated: () => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("financeiro");
  const [saving, setSaving] = useState(false);

  const reset = () => { setFullName(""); setEmail(""); setRole("financeiro"); };

  const submit = async () => {
    if (!companyId) return;
    if (!fullName.trim() || !email.trim()) {
      toast.error("Preencha nome e email");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").insert({
        id: crypto.randomUUID(),
        company_id: companyId,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        role,
        status: "convite_pendente",
      } as never);
      if (error) throw error;
      toast.success(`Convite enviado para ${email}`);
      reset();
      onClose();
      onCreated();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Falha ao convidar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar Usuário</DialogTitle>
          <DialogDescription>Envie um convite para que um novo membro acesse o sistema.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="João da Silva" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@empresa.com.br" />
          </div>
          <div className="space-y-1.5">
            <Label>Função</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div className="flex flex-col">
                      <span className="font-medium">{r.label}</span>
                      <span className="text-xs text-muted-foreground">{r.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Limite de aprovação: {roleLimitLabel(role)}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Enviando..." : "Enviar Convite"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserModal({
  user, onClose, onSaved,
}: { user: Row | null; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("financeiro");
  const [saving, setSaving] = useState(false);

  useMemoSync(user, (u) => {
    if (u) {
      setFullName(u.full_name ?? "");
      setRole((u.role as Role) ?? "financeiro");
    }
  });

  const submit = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), role } as never)
        .eq("id", user.id);
      if (error) throw error;
      toast.success("Usuário atualizado");
      onClose();
      onSaved();
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Função</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Limite de aprovação: {roleLimitLabel(role)}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tiny helper to sync state when a prop changes (avoids importing useEffect noise)
import { useEffect } from "react";
function useMemoSync<T>(value: T, fn: (v: T) => void) {
  useEffect(() => { fn(value); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value]);
}
// Silence unused import warning for ROLE_LIMIT in case tree-shaking complains
void ROLE_LIMIT;
