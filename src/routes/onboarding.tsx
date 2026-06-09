import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuthStore } from "@/store/useStore";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const { setEmpresa, setOnboardingComplete } = useAuthStore();
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [segmento, setSegmento] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEmpresa({ id: crypto.randomUUID(), nome, cnpj, segmento });
    setOnboardingComplete(true);
    toast.success("Empresa configurada!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Configure sua empresa</CardTitle>
          <CardDescription>Apenas alguns dados para personalizar o sistema.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da empresa</Label>
              <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seg">Segmento</Label>
              <Input id="seg" value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Comércio, Serviços, Indústria..." />
            </div>
            <Button type="submit" className="w-full">Continuar</Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
