import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/consignacoes/$id')({
  component: ConsignmentDetailPlaceholder,
});

function ConsignmentDetailPlaceholder() {
  const { id } = Route.useParams();
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-4">Detalhes da Consignação</h1>
      <p className="text-slate-400">ID: {id}</p>
      <p className="text-slate-500 mt-2">Página de detalhes em desenvolvimento.</p>
    </div>
  );
}
