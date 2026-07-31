import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Wallet } from "lucide-react";
import { SaleForm } from "@/features/sales";
import {
  OpenSessionDialog,
  useOpenCashSession,
  isSessionStale,
  staleSessionMessage,
} from "@/features/cash";

import { PageLayout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/vendas_/novo")({
  beforeLoad: requirePermission("sales.view"),
  validateSearch: (search: Record<string, unknown>) => ({
    productId: typeof search.productId === "string" ? search.productId : undefined,
  }),
  component: NewSalePage,
});

function NewSalePage() {
  const { company, user } = Route.useRouteContext();
  const { productId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: openSession, isLoading } = useOpenCashSession(
    company.id,
    user.id,
  );
  const operatorName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    "Operador";
  const [dialogOpen, setDialogOpen] = useState(true);

  if (isLoading) {
    return (
      <PageLayout title="Nova venda" description="Verificando caixa...">
        <Card className="p-10 text-center text-sm text-muted-foreground">
          Carregando...
        </Card>
      </PageLayout>
    );
  }

  const stale = isSessionStale(openSession);

  if (!openSession || stale) {
    const title = stale ? "Caixa pendente de fechamento" : "Caixa fechado";
    const description = stale
      ? staleSessionMessage(openSession!)
      : "Abra o caixa para iniciar as vendas do dia.";
    return (
      <>
        <PageLayout
          title="Nova venda"
          description="É necessário abrir o caixa antes de registrar uma venda."
          icon={Wallet}
        >
          <Card className="p-10 text-center">
            <Wallet className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {description}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {stale ? (
                <Button onClick={() => navigate({ to: "/caixa" })}>
                  Ir para o caixa
                </Button>
              ) : (
                <Button onClick={() => setDialogOpen(true)}>Abrir caixa</Button>
              )}
              <Button
                variant="outline"
                onClick={() => navigate({ to: "/vendas" })}
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </PageLayout>
        {!stale && (
          <OpenSessionDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            companyId={company.id}
            operatorId={user.id}
            operatorName={operatorName}
          />
        )}
      </>
    );
  }


  return <SaleForm companyId={company.id} initialProductId={productId} />;
}
