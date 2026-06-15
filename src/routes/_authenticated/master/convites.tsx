import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Mail, X, Send } from "lucide-react";
import { toast } from "sonner";
import { listPendingInvites, resendInvite, cancelInvite } from "@/lib/master.functions";
import { getAccessToken, formatCompanyDateBR } from "@/lib/master";
import { ROLE_LABEL, ROLE_BADGE, type Role } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/master/convites")({
  ssr: false,
  head: () => ({ meta: [{ title: "Convites — Super Admin" }] }),
  component: ConvitesPage,
});

function ConvitesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPendingInvites);
  const resendFn = useServerFn(resendInvite);
  const cancelFn = useServerFn(cancelInvite);

  const invitesQ = useQuery({
    queryKey: ["master", "invites"],
    queryFn: async () => listFn({ data: { token: await getAccessToken() } }),
  });

  const resend = useMutation({
    mutationFn: async (email: string) => resendFn({ data: { token: await getAccessToken(), email } }),
    onSuccess: () => toast.success("Convite reenviado"),
    onError: (e: Error) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: async (profileId: string) => cancelFn({ data: { token: await getAccessToken(), profileId } }),
    onSuccess: () => { toast.success("Convite cancelado"); qc.invalidateQueries({ queryKey: ["master", "invites"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const invites = invitesQ.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Convites pendentes" description="Convites aguardando aceite em todas as empresas." />
      <Card>
        <CardContent className="p-4">
          {invitesQ.isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : invitesQ.isError ? (
            <div className="py-12 text-center text-sm text-destructive">{(invitesQ.error as Error).message}</div>
          ) : invites.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nenhum convite pendente.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((i) => {
                  const r = (i.role as Role) ?? "vendas";
                  return (
                    <TableRow key={i.id as string}>
                      <TableCell className="font-medium">{(i.full_name as string) || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{i.email as string}</TableCell>
                      <TableCell>{i.company_name}</TableCell>
                      <TableCell><Badge variant="outline" className={ROLE_BADGE[r] ?? ""}>{ROLE_LABEL[r] ?? r}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatCompanyDateBR(i.created_at as string)}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" disabled={resend.isPending} onClick={() => resend.mutate(i.email as string)}>
                          <Send className="h-3.5 w-3.5 mr-1" /> Reenviar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" disabled={cancel.isPending} onClick={() => cancel.mutate(i.id as string)}>
                          <X className="h-3.5 w-3.5 mr-1" /> Cancelar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
