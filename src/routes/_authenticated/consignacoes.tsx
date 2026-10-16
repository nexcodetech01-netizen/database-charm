import { createFileRoute, Outlet, useLocation } from '@tanstack/react-router';
import { ConsignmentsList } from '@/features/consignment/components/consignments-list';

export const Route = createFileRoute('/_authenticated/consignacoes')({
  component: ConsignmentsLayout,
});

// A lista só aparece em /consignacoes; no detalhe (/consignacoes/$id) mostra
// apenas o detalhe. Usa a rota do app (não window.location) para atualizar
// ao navegar e funcionar no servidor.
function ConsignmentsLayout() {
  const pathname = useLocation({ select: (l) => l.pathname });
  const isListView = pathname.replace(/\/+$/, '') === '/consignacoes';
  return isListView ? <ConsignmentsList /> : <Outlet />;
}
