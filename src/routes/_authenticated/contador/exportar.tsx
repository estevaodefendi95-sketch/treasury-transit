import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/contador/exportar")({
  ssr: false,
  head: () => ({ meta: [{ title: "Exportar — Contador" }] }),
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Exportar" description="Atalhos para exportação rápida" />
      <Card>
        <CardContent className="p-6">
          <Link to="/contador/dashboard" className="flex items-center gap-3 text-primary hover:underline">
            <Download className="h-5 w-5" /> Voltar ao dashboard para exportar DRE / Lançamentos / Centro de Custo
          </Link>
        </CardContent>
      </Card>
    </div>
  ),
});
