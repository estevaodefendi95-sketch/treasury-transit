import { useMemo } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { notificationsQuery, NOTIFICATION_META, timeAgo, type AppNotification } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: notifications = [] } = useQuery(notificationsQuery(companyId));
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  );
  const top20 = notifications.slice(0, 20);

  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", companyId] }),
  });

  const handleClick = (n: AppNotification) => {
    if (!n.is_read) markRead.mutate([n.id]);
    if (n.link_url) navigate({ to: n.link_url });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Notificações">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-semibold flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() =>
                markRead.mutate(top20.filter((n) => !n.is_read).map((n) => n.id))
              }
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {top20.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            top20.map((n) => {
              const meta = NOTIFICATION_META[n.type] ?? {
                icon: "🔔",
                color: "text-muted-foreground bg-muted/20",
                label: n.type,
              };
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={cn(
                    "w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-muted/40 transition",
                    !n.is_read && "bg-primary/5",
                  )}
                >
                  <div className="flex gap-2">
                    <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", meta.color)}>
                      <span className="text-sm">{meta.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{n.title}</div>
                      {n.message && (
                        <div className="text-xs text-muted-foreground truncate">{n.message}</div>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {timeAgo(n.created_at)}
                      </div>
                    </div>
                    {!n.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="border-t px-3 py-2 text-center">
          <Link to="/notificacoes" className="text-xs text-primary hover:underline">
            Ver todas
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
