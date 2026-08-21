import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

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

  return (
    <div className="min-h-screen bg-[#161310] text-white">
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-8 text-center">
          <Package className="mx-auto h-8 w-8 text-[#E5A855]" />
          <h1 className="mt-3 text-lg font-bold uppercase tracking-widest text-[#E5A855]">
            Rastreie seu pedido
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Digite o código de rastreio que você recebeu.
          </p>
        </div>

        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: PN123456789BR"
                className="bg-black/20 text-center font-mono uppercase"
                autoFocus
              />
              <Button
                type="submit"
                disabled={!code.trim()}
                className="w-full gap-2 bg-[#E5A855] text-black hover:bg-[#E5A855]/90"
              >
                <Search className="h-4 w-4" />
                Rastrear
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
