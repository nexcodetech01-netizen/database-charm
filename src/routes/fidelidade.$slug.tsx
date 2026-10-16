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
import { StorefrontShell } from "@/features/storefront/components/storefront-shell";

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
  const branding = storeQ.data && "branding" in storeQ.data ? storeQ.data.branding : null;
  const storeName = branding?.name ?? null;

  const mutation = useMutation({
    mutationFn: (typed: string) => getBalanceFn({ data: { slug, phone: typed } }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) return;
    mutation.mutate(phone.trim());
  }

  const result = mutation.data;

  return (
    <StorefrontShell
      branding={branding}
      icon={Gift}
      title="Meus pontos"
      subtitle={
        <>
          Digite seu telefone com DDD (o mesmo usado nas suas compras
          {storeName ? ` na ${storeName}` : ""}) para ver seus pontos.
        </>
      }
    >
      <Card>
        <CardContent className="p-6">
          {storeStatus === "store_not_found" || storeStatus === "program_disabled" ? (
            <div role="alert" className="text-center">
              <p className="font-medium">
                {storeStatus === "store_not_found"
                  ? "Loja não encontrada"
                  : "Programa de pontos indisponível"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
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
                  className="text-center"
                  type="tel"
                  inputMode="tel"
                  autoFocus
                  aria-label="Telefone com DDD"
                />
                <Button
                  type="submit"
                  disabled={!phone.trim() || mutation.isPending || storeQ.isLoading}
                  className="w-full gap-2"
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
                <div className="mt-6 border-t border-border pt-6 text-center">
                  {!result.found && result.reason === "rate_limited" ? (
                    <p className="text-sm text-muted-foreground">{result.error}</p>
                  ) : !result.found && result.reason === "store_not_found" ? (
                    <p className="text-sm text-muted-foreground">
                      Este link não é de nenhuma loja. Confira o endereço com a loja.
                    </p>
                  ) : !result.found && result.reason === "program_disabled" ? (
                    <p className="text-sm text-muted-foreground">
                      Esta loja não está com o programa de pontos ativo no momento.
                    </p>
                  ) : result.found ? (
                    <>
                      <p className="text-sm text-muted-foreground">Olá, {result.customerName}!</p>
                      <p className="mt-2 text-3xl font-bold text-primary">
                        {result.points} pontos
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Vale aproximadamente{" "}
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }).format(result.valueInReais)}{" "}
                        em desconto na próxima compra.
                      </p>
                    </>
                  ) : (
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">
                        Não achamos cadastro com o telefone {mutation.variables}
                        {storeName ? ` na ${storeName}` : ""}.
                      </p>
                      <p>
                        Confira se digitou certo, com DDD. Se o número está certo, é possível
                        que a loja tenha cadastrado outro telefone — fale com ela para conferir.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </StorefrontShell>
  );
}
