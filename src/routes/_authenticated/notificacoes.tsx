import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCheck, Trash2, Bell } from "lucide-react";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { notificationsQuery, NOTIFICATION_META, timeAgo, type AppNotification } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Notificações — SuaEmpresa Gestão" }] }),
  component: NotificacoesPage,
});

function NotificacoesPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const { data: notifications = [] } = useQuery(notificationsQuery(companyId));

  const [typeFilter, setTypeFilter] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = notifications.filter((n) => {
    if (typeFilter && n.type !== typeFilter) return false;
    if (readFilter === "read" && !n.is_read) return false;
    if (readFilter === "unread" && n.is_read) return false;
    return true;
  });

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications", companyId] });
      setSelected(new Set());
      toast.success("Notificações marcadas como lidas");
    },
  });

  const deleteOld = useMutation({
    mutationFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      const { error, count } = await supabase
        .from("notifications")
        .delete({ count: "exact" })
        .eq("company_id", companyId!)
        .lt("created_at", cutoff.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["notifications", companyId] });
      toast.success(`${n} notificações antigas removidas`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const types = Object.keys(NOTIFICATION_META);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificações"
        description="Histórico completo de alertas."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/configuracoes/notificacoes">Preferências</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => deleteOld.mutate()}
              disabled={deleteOld.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Limpar 30+ dias
            </Button>
          </div>
        }
      />
      <Card>
        <CardHeader>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">Todos os tipos</option>
              {types.map((t) => (
                <option key={t} value={t}>{NOTIFICATION_META[t].label}</option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value as typeof readFilter)}
            >
              <option value="all">Todas</option>
              <option value="unread">Não lidas</option>
              <option value="read">Lidas</option>
            </select>
            {selected.size > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => markRead.mutate(Array.from(selected))}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Marcar {selected.size} como lida{selected.size > 1 ? "s" : ""}
              </Button>
            )}
            {filtered.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelected(
                    selected.size === filtered.length ? new Set() : new Set(filtered.map((n) => n.id)),
                  )
                }
              >
                {selected.size === filtered.length ? "Limpar seleção" : "Selecionar todas"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon="✅" title="Tudo em dia!" description="Você não tem notificações no momento" />
          ) : (
            <ul className="divide-y">
              {filtered.map((n: AppNotification) => {
                const meta = NOTIFICATION_META[n.type] ?? {
                  icon: "🔔",
                  color: "text-muted-foreground bg-muted/20",
                  label: n.type,
                };
                return (
                  <li
                    key={n.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 hover:bg-muted/30",
                      !n.is_read && "bg-primary/5",
                    )}
                  >
                    <Checkbox
                      checked={selected.has(n.id)}
                      onCheckedChange={() => toggle(n.id)}
                      className="mt-1"
                    />
                    <div className={cn("h-8 w-8 rounded-full flex items-center justify-center shrink-0", meta.color)}>
                      <span>{meta.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{n.title}</span>
                        <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                        {!n.is_read && <Badge className="text-[10px] bg-primary">Nova</Badge>}
                      </div>
                      {n.message && (
                        <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</div>
                    </div>
                    {n.link_url && (
                      <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                        <Link to={n.link_url}>Ver</Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
