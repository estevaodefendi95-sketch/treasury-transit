import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuthStore } from "@/store/useStore";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — SuaEmpresa Gestão" },
      { name: "description", content: "Acesse sua conta no SuaEmpresa Gestão ERP." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");

  // Cadastro
  const [regNome, setRegNome] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");

  const fakeLogin = () => {
    setUser({ id: "demo", email: loginEmail || "demo@suaempresa.com.br", nome: "Usuário Demo" });
    toast.success("Bem-vindo! (modo demonstração)");
    navigate({ to: "/dashboard" });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      fakeLogin();
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPass,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.user) {
      setUser({
        id: data.user.id,
        email: data.user.email ?? "",
        nome: data.user.user_metadata?.nome ?? data.user.email?.split("@")[0] ?? "Usuário",
      });
      toast.success("Login realizado!");
      navigate({ to: "/dashboard" });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setUser({ id: "demo", email: regEmail, nome: regNome });
      toast.success("Conta criada! (modo demonstração)");
      navigate({ to: "/onboarding" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: regEmail,
      password: regPass,
      options: {
        data: { nome: regNome },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.user) {
      setUser({ id: data.user.id, email: data.user.email ?? regEmail, nome: regNome });
      toast.success("Conta criada!");
      navigate({ to: "/onboarding" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 rounded-xl bg-primary text-primary-foreground items-center justify-center text-lg font-bold mb-3">
            SE
          </div>
          <h1 className="text-2xl font-bold text-foreground">SuaEmpresa Gestão</h1>
          <p className="text-sm text-muted-foreground">ERP financeiro para sua empresa</p>
        </div>

        <Card>
          <Tabs defaultValue="login" className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="register">Criar conta</TabsTrigger>
              </TabsList>
            </CardHeader>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  <CardDescription>Acesse sua conta para gerenciar suas finanças.</CardDescription>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" required value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="voce@empresa.com.br" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pass">Senha</Label>
                    <Input id="pass" type="password" required value={loginPass} onChange={(e) => setLoginPass(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>
                  {!isSupabaseConfigured && (
                    <p className="text-xs text-muted-foreground text-center">
                      Modo demonstração ativo. Configure o Supabase em <code className="bg-muted px-1 rounded">src/integrations/supabase/client.ts</code>.
                    </p>
                  )}
                </CardContent>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister}>
                <CardContent className="space-y-4">
                  <CardDescription>Crie sua conta em segundos.</CardDescription>
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome completo</Label>
                    <Input id="nome" required value={regNome} onChange={(e) => setRegNome(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regemail">E-mail</Label>
                    <Input id="regemail" type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regpass">Senha</Label>
                    <Input id="regpass" type="password" required minLength={6} value={regPass} onChange={(e) => setRegPass(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Criando..." : "Criar conta"}
                  </Button>
                </CardContent>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
