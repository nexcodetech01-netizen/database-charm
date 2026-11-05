import { createFileRoute } from "@tanstack/react-router";
import { HeartPulse, RefreshCw } from "lucide-react";
import { requirePermission } from "@/features/rbac";
import { PageLayout, ListSkeleton } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { describeSaveError } from "@/lib/describe-error";
import { SystemHealthList, useSystemHealth } from "@/features/system-health";

export const Route = createFileRoute("/_authenticated/saude-sistema")({
  beforeLoad: requirePermission("settings.view"),
  head: () => ({ meta: [{ title: "Saúde do sistema | NexOS" }] }),
  component: SystemHealthPage,
});

function SystemHealthPage() {
  const { company } = Route.useRouteContext();
  const { data, isLoading, isError, error, refetch, isFetching } = useSystemHealth(company.id);

  return (
    <PageLayout
      title="Saúde do sistema"
      description="Confere se estoque, contas, vendas, compras e vales estão batendo. Clique num item para abrir e corrigir."
      icon={HeartPulse}
      actions={
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={"mr-2 h-4 w-4" + (isFetching ? " animate-spin" : "")} />
          Conferir de novo
        </Button>
      }
    >
      {isLoading ? (
        <ListSkeleton />
      ) : isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            Não foi possível conferir agora: {describeSaveError(error)}
          </AlertDescription>
        </Alert>
      ) : (
        <SystemHealthList issues={data ?? []} />
      )}
    </PageLayout>
  );
}
