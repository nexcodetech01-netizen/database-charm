import { createFileRoute } from '@tanstack/react-router';
import { Users } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/revendedores')({
  component: ResellersPage,
});

function ResellersPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-white tracking-tight">Revendedores</h1>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
          Novo Revendedor
        </button>
      </div>

      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 p-8 text-center text-slate-500">
        Nenhum revendedor cadastrado ainda.
      </div>
    </div>
  );
}
