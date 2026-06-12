import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link2, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cobrancas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Cobranças" }] }),
  component: CobrancasPlaceholder,
});

function CobrancasPlaceholder() {
  return (
    <div className="max-w-2xl mx-auto py-12">
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Link2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold">Integração com Asaas</h1>
          <p className="text-sm text-muted-foreground">
            As cobranças serão gerenciadas pelo Asaas.
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Este módulo está temporariamente desativado. Em breve você poderá
            conectar sua conta Asaas para gerenciar cobranças automaticamente.
          </p>
          <div className="pt-2">
            <Button asChild>
              <a href="https://asaas.com" target="_blank" rel="noreferrer">
                Conhecer o Asaas <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
