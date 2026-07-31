import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { CashWorkspace } from "@/features/cash";

export const Route = createFileRoute("/_authenticated/caixa")({
  beforeLoad: requirePermission("finance.view"),
  component: CashPage,
});

function CashPage() {
  const { company, user } = Route.useRouteContext();
  const operatorName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    "Operador";
  return (
    <CashWorkspace
      companyId={company.id}
      companyName={company.trade_name ?? company.name ?? "NexOS"}
      operatorId={user.id}
      operatorName={operatorName}
    />
  );
}
