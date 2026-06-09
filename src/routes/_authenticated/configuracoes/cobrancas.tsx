import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { Save, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_CHARGING_RULES, type ChargingRule } from "@/lib/charging";

export const Route = createFileRoute("/_authenticated/configuracoes/cobrancas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Régua de Cobrança" }] }),
  component: ConfigCobrancasPage,
});

function ConfigCobrancasPage() {
  const { companyId } = useCurrentCompany();
  const qc = useQueryClient();
  const [rules, setRules] = useState<ChargingRule[]>(DEFAULT_CHARGING_RULES);

  const schedule = useQuery({
    queryKey: ["charging_schedule", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("charging_schedules")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; rules: ChargingRule[] } | null;
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (schedule.data?.rules && Array.isArray(schedule.data.rules)) {
      setRules(schedule.data.rules as ChargingRule[]);
    }
  }, [schedule.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Sem empresa");
      const sorted = [...rules].sort((a, b) => a.days_offset - b.days_offset);
      const { error } = await supabase
        .from("charging_schedules")
        .upsert(
          { company_id: companyId, rules: sorted },
          { onConflict: "company_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Régua salva");
      qc.invalidateQueries({ queryKey: ["charging_schedule", companyId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (idx: number, patch: Partial<ChargingRule>) =>
    setRules((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const remove = (idx: number) =>
    setRules((rs) => rs.filter((_, i) => i !== idx));

  const add = () =>
    setRules((rs) => [
      ...rs,
      {
        days_offset: 0,
        channel: "whatsapp",
        message_template: "Olá, {cliente}! ...",
        is_active: true,
      },
    ]);

  const labelFor = (offset: number) => {
    if (offset < 0) return `${Math.abs(offset)}d antes do vencimento`;
    if (offset === 0) return "No dia do vencimento";
    return `${offset}d após vencimento`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Régua de Cobrança"
        description="Defina mensagens automáticas para cada momento do ciclo de cobrança."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Regras</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={add}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova regra
            </Button>
            <Button
              size="sm"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
            >
              {saveMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5 mr-1" />
              )}
              Salvar régua
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules
            .map((r, i) => ({ r, i }))
            .sort((a, b) => a.r.days_offset - b.r.days_offset)
            .map(({ r, i }) => (
              <div
                key={i}
                className={`border rounded-lg p-3 space-y-3 ${r.is_active ? "" : "opacity-60"}`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge offset={r.days_offset} />
                    <span className="text-sm font-medium">
                      {labelFor(r.days_offset)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={(v) => update(i, { is_active: v })}
                      />
                      <span className="text-xs text-muted-foreground">
                        {r.is_active ? "Ativa" : "Inativa"}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Dias (- antes / + após)</Label>
                    <Input
                      type="number"
                      value={r.days_offset}
                      onChange={(e) =>
                        update(i, { days_offset: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">Canal</Label>
                    <Select
                      value={r.channel}
                      onValueChange={(v) =>
                        update(i, { channel: v as ChargingRule["channel"] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">📱 WhatsApp</SelectItem>
                        <SelectItem value="email">📧 Email</SelectItem>
                        <SelectItem value="manual">📋 Manual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">
                    Mensagem (use {"{cliente}"}, {"{valor}"}, {"{vencimento}"}, {"{dias}"})
                  </Label>
                  <Textarea
                    rows={3}
                    value={r.message_template}
                    onChange={(e) =>
                      update(i, { message_template: e.target.value })
                    }
                  />
                </div>
              </div>
            ))}
          {rules.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">
              Nenhuma regra. Adicione uma para começar.
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        💡 A geração de mensagem na tela de Cobranças usa IA e considera o cliente, valor
        e atraso reais. Os templates acima servem de referência manual e para integrações futuras.
      </p>
    </div>
  );
}

function Badge({ offset }: { offset: number }) {
  const color =
    offset < 0
      ? "bg-sky-100 text-sky-700"
      : offset === 0
        ? "bg-amber-100 text-amber-700"
        : offset <= 7
          ? "bg-orange-100 text-orange-700"
          : "bg-rose-100 text-rose-700";
  const label = offset >= 0 ? `+${offset}d` : `${offset}d`;
  return (
    <span className={`text-xs font-mono px-2 py-0.5 rounded ${color}`}>
      {label}
    </span>
  );
}
