import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingPolicyForm, PricingSimulator } from "@/features/pricing";
import { CategoryMarginPolicySection } from "@/features/pricing/components/category-margin-policy-section";

export const Route = createFileRoute("/_authenticated/configuracoes/precificacao")({
  beforeLoad: requirePermission("settings.view"),
  component: PricingSettingsPage,
});

function PricingSettingsPage() {
  const { company } = Route.useRouteContext();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link to="/configuracoes" className="hover:text-foreground">
              Configurações
            </Link>
            <span>›</span>
            <span>Comercial</span>
            <span>›</span>
            <span className="text-foreground">Política Comercial</span>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <TrendingUp className="h-5 w-5 text-primary" />
            Política Comercial
          </h1>
          <p className="text-sm text-muted-foreground">
            Centraliza as regras comerciais por categoria — margem alvo, margem mínima e desconto padrão — usadas pela Bella IA, cadastro de produtos e PDV.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/configuracoes">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="categories" className="w-full">
        <TabsList>
          <TabsTrigger value="categories">Política Comercial</TabsTrigger>
          <TabsTrigger value="policy">Política avançada</TabsTrigger>
          <TabsTrigger value="simulator">Simulador</TabsTrigger>
        </TabsList>
        <TabsContent value="categories" className="mt-6">
          <CategoryMarginPolicySection companyId={company.id} />
        </TabsContent>
        <TabsContent value="policy" className="mt-6">
          <PricingPolicyForm companyId={company.id} />
        </TabsContent>
        <TabsContent value="simulator" className="mt-6">
          <PricingSimulator companyId={company.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

