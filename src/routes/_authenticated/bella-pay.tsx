import { createFileRoute, Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FlaskConical } from "lucide-react";
import { ConfigPanel, ChargesPanel } from "@/features/bella-pay";
import { usePermissions, requirePermission } from "@/features/rbac";

export const Route = createFileRoute("/_authenticated/bella-pay")({
  beforeLoad: requirePermission("bella_pay.view"),
  component: BellaPayPage,
});

function BellaPayPage() {
  const { company } = Route.useRouteContext();
  const { isOwner } = usePermissions();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bella Pay</h1>
          <p className="text-sm text-muted-foreground">
            Integração Asaas: PIX, cartão de crédito e link de pagamento.
          </p>
        </div>
        {isOwner ? (
          <Button asChild variant="outline" size="sm">
            <Link to="/bella-pay/test">
              <FlaskConical className="mr-2 h-4 w-4" />
              Testes internos
            </Link>
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="charges" className="space-y-6">
        <TabsList>
          <TabsTrigger value="charges">Cobranças</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>

        <TabsContent value="charges">
          <ChargesPanel companyId={company.id} />
        </TabsContent>

        <TabsContent value="config">
          <ConfigPanel companyId={company.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
