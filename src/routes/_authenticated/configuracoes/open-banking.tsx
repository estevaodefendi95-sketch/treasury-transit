import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Info, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/configuracoes/open-banking")({
  ssr: false,
  head: () => ({ meta: [{ title: "Open Banking — SuaEmpresa Gestão" }] }),
  component: OpenBankingPage,
});

const BANKS = [
  { name: "Itaú", color: "#EC7000", initial: "I" },
  { name: "Bradesco", color: "#CC092F", initial: "B" },
  { name: "Santander", color: "#EC0000", initial: "S" },
  { name: "Banco do Brasil", color: "#FFEF38", initial: "BB", textDark: true },
  { name: "Nubank", color: "#820AD1", initial: "N" },
  { name: "Inter", color: "#FF7A00", initial: "I" },
  { name: "Sicoob", color: "#003641", initial: "S" },
  { name: "Caixa Econômica", color: "#0070AF", initial: "C" },
];

function OpenBankingPage() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Conexão Automática com Bancos"
        description="Importe extratos automaticamente sem precisar de arquivo OFX/PDF"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {BANKS.map((b) => (
          <Card key={b.name} className="overflow-hidden">
            <CardContent className="p-4 flex flex-col items-center gap-3 text-center">
              <div
                className="h-14 w-14 rounded-xl flex items-center justify-center font-bold text-lg"
                style={{
                  background: b.color,
                  color: b.textDark ? "#003641" : "#ffffff",
                }}
              >
                {b.initial}
              </div>
              <div className="font-medium text-sm">{b.name}</div>
              <Badge variant="secondary" className="text-[10px]">Em breve</Badge>
              <Button
                variant="outline"
                size="sm"
                disabled
                className="w-full"
                onClick={() => setSelected(b.name)}
              >
                Conectar
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-primary mt-0.5" />
            <p className="text-sm">
              <span className="font-medium">Por enquanto, use a importação manual</span> de OFX ou PDF
              na seção Importar Extrato.
            </p>
          </div>
          <Button asChild>
            <Link to="/financeiro/importar">
              <Upload className="h-4 w-4 mr-2" />
              Ir para Importação
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Integração Open Banking</DialogTitle>
            <DialogDescription>
              A conexão automática com <span className="font-medium">{selected}</span> será
              disponibilizada em breve através da API Pluggy.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setSelected(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
