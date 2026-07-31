import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton mínimo exibido APENAS quando uma rota demora mais que
 * `router.defaultPendingMs` para resolver. Nunca deve piscar em navegações
 * rápidas — quando o loader responde em <1500ms, o TanStack Router mantém a
 * rota atual visível e este componente não monta.
 *
 * Renderiza dentro do <main> do AppLayout (Layout persistente), portanto NÃO
 * inclui sidebar / topbar / breadcrumb — apenas placeholders da área de
 * conteúdo, mantendo a moldura estável.
 */
export function RoutePending() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando conteúdo"
      data-testid="route-pending"
      className="space-y-6"
    >
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
