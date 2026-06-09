import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GitCompareArrows } from "lucide-react";

export const Route = createFileRoute("/_authenticated/financeiro/conciliacao")({
  head: () => ({ meta: [{ title: "Conciliação Bancária — SuaEmpresa Gestão" }] }),
  component: () => (
    <>
      <PageHeader title="Conciliação Bancária" description="Compare extratos bancários com as transações do sistema." />
      <Card>
        <CardHeader><CardTitle className="text-base">Importar extrato</CardTitle></CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-border rounded-lg p-10 text-center">
            <GitCompareArrows className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Arraste um arquivo OFX/CSV aqui ou clique para selecionar.</p>
            <Button variant="outline">Selecionar arquivo</Button>
          </div>
        </CardContent>
      </Card>
    </>
  ),
});
