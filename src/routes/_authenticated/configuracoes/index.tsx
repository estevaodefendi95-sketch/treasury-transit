import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Bell, ShieldCheck, Receipt, Banknote, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/configuracoes/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Configurações — SuaEmpresa Gestão" }] }),
  component: ConfigPage,
});

const LINKS = [
  { to: "/configuracoes/aprovacoes" as const, title: "Limites de Aprovação", icon: ShieldCheck, desc: "Defina valores que exigem aprovação por papel" },
  { to: "/configuracoes/cobrancas" as const, title: "Régua de Cobrança", icon: Receipt, desc: "Configure mensagens automáticas de cobrança" },
  { to: "/configuracoes/notificacoes" as const, title: "Notificações", icon: Bell, desc: "Preferências de alertas" },
  { to: "/configuracoes/open-banking" as const, title: "Open Banking", icon: Banknote, desc: "Conexão automática com bancos" },
];

function ConfigPage() {
  const { company, companyId, profile } = useCurrentCompany();
  const qc = useQueryClient();
  const isAdmin = profile?.role === "admin";
  const [lockedUntil, setLockedUntil] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLockedUntil((company as any)?.locked_until ?? "");
  }, [company]);

  const save = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ locked_until: lockedUntil || null } as any)
        .eq("id", companyId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["company"] });
      toast.success("Período de fechamento atualizado");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Ajustes da empresa e preferências do sistema" />

      <div className="grid md:grid-cols-2 gap-3">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to}>
            <Card className="hover:border-primary/50 transition">
              <CardContent className="p-4 flex items-center gap-3">
                <l.icon className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{l.title}</div>
                  <div className="text-xs text-muted-foreground">{l.desc}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lock className="h-4 w-4" /> Fechamento de período
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Lançamentos com data até a data abaixo ficarão bloqueados para edição.
            </p>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label>Bloquear lançamentos até:</Label>
                <Input
                  type="date"
                  value={lockedUntil}
                  onChange={(e) => setLockedUntil(e.target.value)}
                  className="w-48"
                />
              </div>
              <Button onClick={save} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              {lockedUntil && (
                <Button variant="ghost" onClick={() => setLockedUntil("")}>Limpar</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
