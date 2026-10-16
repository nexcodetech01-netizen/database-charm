import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StorefrontShell } from "@/features/storefront/components/storefront-shell";

export const Route = createFileRoute("/rastreio/")({
  component: RastreioEntryPage,
});

function RastreioEntryPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    navigate({ to: "/rastreio/$trackingCode", params: { trackingCode: trimmed } });
  }

  // Sem código ainda não sabemos de qual loja é: visual neutro.
  return (
    <StorefrontShell
      icon={Package}
      title="Rastreie seu pedido"
      subtitle="Digite o código de rastreio que você recebeu."
    >
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ex: PN123456789BR"
              className="text-center font-mono uppercase"
              aria-label="Código de rastreio"
              autoFocus
            />
            <Button type="submit" disabled={!code.trim()} className="w-full gap-2">
              <Search className="h-4 w-4" />
              Rastrear
            </Button>
          </form>
        </CardContent>
      </Card>
    </StorefrontShell>
  );
}
