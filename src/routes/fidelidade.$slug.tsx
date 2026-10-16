import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Gift, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  getLoyaltyBalanceByPhone,
  getLoyaltyStoreStatus,
} from "@/features/loyalty/lib/loyalty-public.functions";

export const Route = createFileRoute("/fidelidade/$slug")({
  component: FidelidadePage,
});

function FidelidadePage() {
  const { slug } = Route.useParams();
  const [phone, setPhone] = useState("");
  const getBalanceFn = useServerFn(getLoyaltyBalanceByPhone);
  const getStoreStatusFn = useServerFn(getLoyaltyStoreStatus);
  const storeQ = useQuery({
    queryKey: ["loyalty-store-status", slug],
    queryFn: () => getStoreStatusFn({ data: { slug } }),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  // Em caso de dúvida (erro/limite), mostramos o formulário normalmente.
  const storeStatus = storeQ.data?.status;

  const mutation = useMutation({
    mutationFn: () => getBalanceFn({ data: { slug, phone } }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    mutation.mutate();
  }

  const result = mutation.data;

  return (
    <div className="min-h-screen bg-[#161310] text-white">
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-8 text-center">
          <Gift className="mx-auto h-8 w-8 text-[#B392E0]" />
          <h1 className="mt-3 text-lg font-bold uppercase tracking-widest text-[#B392E0]">
            Meus pontos
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Digite seu telefone (o mesmo usado nas suas compras) pra ver seus pontos.
          </p>
        </div>

        <Card className="border-white/10 bg-white/5">
          <CardContent className="p-6">
            {storeStatus === "store_not_found" || storeStatus === "program_disabled" ? (
              <div role="alert" className="text-center">
                <p className="font-medium">
                  {storeStatus === "store_not_found"
                    ? "Loja não encontrada"
                    : "Programa de pontos indisponível"}
                </p>
                <p className="mt-2 text-sm text-white/60">
                  {storeStatus === "store_not_found"
                    ? "Este link não é de nenhuma loja. Confira o endereço com a loja que te enviou."
                    : "Esta loja não está com o programa de pontos ativo no momento."}
                </p>
              </div>
            ) : (
            <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(14) 99999-9999"
                className="bg-black/20 text-center"
                type="tel"
                autoFocus
              />
              <Button
                type="submit"
                disabled={!phone.trim() || mutation.isPending || storeQ.isLoading}
                className="w-full gap-2 bg-[#B392E0] text-black hover:bg-[#B392E0]/90"
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Consultar
              </Button>
            </form>

            {result && (
              <div className="mt-6 border-t border-white/10 pt-6 text-center">
                {!result.found && result.reason === "rate_limited" ? (
                  <p className="text-sm text-white/60">{result.error}</p>
                ) : !result.found && result.reason === "store_not_found" ? (
                  <p className="text-sm text-white/60">
                    Este link não é de nenhuma loja. Confira o endereço com a loja.
                  </p>
                ) : !result.found && result.reason === "program_disabled" ? (
                  <p className="text-sm text-white/60">
                    Esta loja não está com o programa de pontos ativo no momento.
                  </p>
                ) : result.found ? (
                  <>
                    <p className="text-sm text-white/60">Olá, {result.customerName}!</p>
                    <p className="mt-2 text-3xl font-bold text-[#B392E0]">{result.points} pontos</p>
                    <p className="mt-1 text-sm text-white/60">
                      Vale aproximadamente{" "}
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        result.valueInReais,
                      )}{" "}
                      em desconto na próxima compra.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-white/60">
                    Não encontramos pontos pra esse telefone ainda. Faça uma compra pra começar a
                    acumular!
                  </p>
                )}
              </div>
            )}
            </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
