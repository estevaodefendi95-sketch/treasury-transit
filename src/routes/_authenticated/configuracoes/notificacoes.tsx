import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_META } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/configuracoes/notificacoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Preferências de Notificação — SuaEmpresa Gestão" }] }),
  component: PreferenciasPage,
});

function PreferenciasPage() {
  const { user, profile } = useCurrentCompany();
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({ ...DEFAULT_NOTIFICATION_PREFS });

  useEffect(() => {
    if (profile?.notification_preferences) {
      setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...profile.notification_preferences });
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem usuário");
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: prefs })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Preferências salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Preferências de Notificação" description="Escolha quais alertas deseja receber." />
      <Card>
        <CardHeader><CardTitle className="text-base">Tipos de notificação</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(NOTIFICATION_META).map(([key, meta]) => (
            <div key={key} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${meta.color}`}>
                  <span>{meta.icon}</span>
                </div>
                <span className="text-sm font-medium">{meta.label}</span>
              </div>
              <Switch
                checked={prefs[key] ?? true}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
              />
            </div>
          ))}
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full mt-4">
            {save.isPending ? "Salvando..." : "Salvar preferências"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
