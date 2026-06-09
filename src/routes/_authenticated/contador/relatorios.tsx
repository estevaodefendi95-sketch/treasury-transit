import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contador/relatorios")({
  ssr: false,
  head: () => ({ meta: [{ title: "Relatórios — Contador" }] }),
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Use os relatórios completos em modo somente-leitura" />
      <Card>
        <CardContent className="p-6">
          <Link to="/relatorios" className="flex items-center gap-3 text-primary hover:underline">
            <BarChart3 className="h-5 w-5" /> Abrir Relatórios (DRE, Fluxo, Inadimplência, Categorias, Centro de Custo)
          </Link>
        </CardContent>
      </Card>
    </div>
  ),
});
