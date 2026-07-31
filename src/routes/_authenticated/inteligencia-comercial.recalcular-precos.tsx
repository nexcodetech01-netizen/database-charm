import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { PriceRecalculationWorkspace } from "@/features/pricing/components/price-recalculation-workspace";

export const Route = createFileRoute(
  "/_authenticated/inteligencia-comercial/recalcular-precos",
)({
  beforeLoad: requirePermission("products.view"),
  head: () => ({
    meta: [
      { title: "Recalcular Preços · NexOS" },
      {
        name: "description",
        content:
          "Recalcula todos os produtos usando o Pricing Engine atual, compara com o preço atual e aplica em lote com auditoria.",
      },
      { property: "og:title", content: "Recalcular Preços · NexOS" },
      {
        property: "og:description",
        content: "Recalcule e aplique preços em lote com confirmação e auditoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PriceRecalculationPage,
});

function PriceRecalculationPage() {
  const { company } = Route.useRouteContext();
  return <PriceRecalculationWorkspace companyId={company.id} />;
}
