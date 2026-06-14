import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useCurrentCompany } from "@/hooks/useCurrentCompany";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_META } from "@/lib/db";
import { ROLE_AVATAR_BG, ROLE_LABEL, initialsOf, type Role } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/configuracoes/perfil")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meu Perfil — SuaEmpresa Gestão" }] }),
  component: PerfilPage,
});

function PerfilPage() {
  const { user, profile, company } = useCurrentCompany();
  const qc = useQueryClient();
  const role = (profile?.role as Role) ?? "vendas";

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [uploading, setUploading] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  const [prefs, setPrefs] = useState<Record<string, boolean>>({ ...DEFAULT_NOTIFICATION_PREFS });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? "");
      setAvatarUrl(profile.avatar_url ?? "");
      setPrefs({ ...DEFAULT_NOTIFICATION_PREFS, ...(profile.notification_preferences ?? {}) });
    }
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem usuário");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim(), avatar_url: avatarUrl || null } as never)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePrefs = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem usuário");
      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: prefs } as never)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Preferências salvas");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changePassword = async () => {
    if (newPwd.length < 8) return toast.error("Nova senha deve ter ao menos 8 caracteres");
    if (newPwd !== confirmPwd) return toast.error("As senhas não conferem");
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    if (error) return toast.error(error.message);
    toast.success("Senha alterada");
    setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
  };

  const handleUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success("Avatar atualizado — clique em Salvar");
    } catch (e: unknown) {
      toast.error((e as Error).message ?? "Falha no upload (verifique se o bucket 'avatars' existe)");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Meu Perfil" description="Gerencie seus dados, senha e preferências" />

      <Card>
        <CardHeader><CardTitle className="text-base">Dados pessoais</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className={`h-20 w-20 rounded-full ${ROLE_AVATAR_BG[role]} text-white flex items-center justify-center text-xl font-bold`}>
                {initialsOf(fullName, profile?.email)}
              </div>
            )}
            <div>
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm hover:bg-accent">
                  <Upload className="h-4 w-4" /> {uploading ? "Enviando..." : "Trocar foto"}
                </div>
              </Label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={profile?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Função</Label>
              <Input value={ROLE_LABEL[role] ?? role} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input value={company?.name ?? ""} disabled />
            </div>
          </div>

          <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
            {saveProfile.isPending ? "Salvando..." : "Salvar alterações"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Alterar senha</CardTitle></CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label>Senha atual</Label>
            <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Nova senha (mínimo 8 caracteres)</Label>
            <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar nova senha</Label>
            <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
          </div>
          <Button onClick={changePassword}>Alterar senha</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Preferências de notificação</CardTitle></CardHeader>
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
          <Button onClick={() => savePrefs.mutate()} disabled={savePrefs.isPending} className="w-full mt-4">
            {savePrefs.isPending ? "Salvando..." : "Salvar preferências"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
