import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  createFileRoute,
  Link,
  notFound,
} from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { PageLayout } from "@/components/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { SaleForm, useSale } from "@/features/sales";
import { reportLovableError } from "@/lib/lovable-error-reporting";

export const Route = createFileRoute("/_authenticated/vendas_/$saleId/editar")({
  beforeLoad: requirePermission("sales.view"),
  // BUG-PDV-022 — Esta rota não possui loader/beforeLoad de propósito.
  // A venda é mantida pelo TanStack Query dentro de <EditSalePage />. Assim,
  // mutações de itens podem invalidar a query de detalhe sem reexecutar a
  // rota autenticada nem remontar o formulário em edição.
  staleTime: Infinity,
  gcTime: 60 * 60_000,
  preloadStaleTime: Infinity,
  preloadGcTime: 60 * 60_000,
  shouldReload: false,
  remountDeps: ({ params }) => ({ saleId: params.saleId }),
  component: EditSalePageBoundary,
});

/**
 * BUG-PDV-021 — Error boundary local para a rota de edição de vendas.
 *
 * Objetivos exigidos pelo bug report:
 *  1. Nunca engolir erro do formulário: qualquer throw no ciclo de render
 *     é impresso no console com prefixo "ERRO CRÍTICO NO FORMULÁRIO" e
 *     reportado ao pipeline de observabilidade.
 *  2. Não deixar o TanStack Router disparar `errorComponent` global (que
 *     poderia ser re-montado pelas invalidações de detalhe e produzir o
 *     loop de telemetria editar → editar).
 *  3. Permitir que o usuário permaneça na mesma URL, com um estado inerte
 *     e um botão manual de "Tentar novamente", sem redirecionamentos
 *     automáticos.
 */
class SaleFormErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Sem try/catch aqui — se o próprio logger falhar, queremos ver.
    // eslint-disable-next-line no-console
    console.error("ERRO CRÍTICO NO FORMULÁRIO:", error, info.componentStack);
    reportLovableError(error, {
      boundary: "sale_edit_form",
      componentStack: info.componentStack,
    });
  }

  render() {
    if (this.state.error) {
      return (
        <PageLayout
          title="Não foi possível abrir esta venda"
          description="A edição foi interrompida por um erro. Recarregue a página para tentar novamente."
        >
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-medium">Erro capturado no formulário:</p>
            <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ error: null })}
              className="mt-3 inline-flex items-center justify-center rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
            >
              Tentar novamente
            </button>
          </div>
        </PageLayout>
      );
    }
    return this.props.children;
  }
}

function EditSalePageBoundary() {
  return (
    <SaleFormErrorBoundary>
      <EditSalePage />
    </SaleFormErrorBoundary>
  );
}

function EditSalePage() {
  const { company } = Route.useRouteContext();
  const { saleId } = Route.useParams();
  const { data: sale, isLoading } = useSale(saleId);

  if (isLoading) {
    return (
      <PageLayout title="Editar venda" description="Carregando dados da venda…">
        <Skeleton className="h-96 w-full" />
      </PageLayout>
    );
  }
  if (!sale) throw notFound();

  // PDV-009 / BUG-PDV-022 — Vendas pagas ou canceladas não podem ser
  // editadas, mas uma mudança assíncrona de status jamais deve navegar a
  // partir desta rota. O operador decide quando sair; isso elimina o único
  // redirect reativo aos dados da venda e impede editar → editar/detalhe em
  // cascata durante invalidações paralelas.
  if (sale.status === "paid" || sale.status === "cancelled") {
    return (
      <PageLayout
        title="Venda não editável"
        description={
          sale.status === "paid"
            ? "Esta venda já foi paga e não pode mais ser alterada."
            : "Esta venda foi cancelada e não pode mais ser alterada."
        }
      >
        <Link
          to="/vendas/$saleId"
          params={{ saleId: sale.id }}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Ver detalhes da venda
        </Link>
      </PageLayout>
    );
  }

  return (
    <SaleForm
      companyId={company.id}
      sale={sale}
      backHref={`/vendas/${sale.id}`}
      backLabel={`Venda ${sale.number}`}
    />
  );
}
