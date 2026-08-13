import { createFileRoute } from '@tanstack/react-router';
import { Package } from 'lucide-react';
import { ConsignmentsList } from '@/features/consignment/components/consignments-list';

export const Route = createFileRoute('/_authenticated/consignacoes')({
  component: ConsignmentsDashboard,
});

function ConsignmentsDashboard() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Package className="h-8 w-8 text-blue-500" />
        <h1 className="text-3xl font-bold text-white tracking-tight">Consignações</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-sm">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Total Consignado</p>
          <p className="text-3xl font-bold text-white mt-2">R$ 0,00</p>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-sm">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Vendido (Mês)</p>
          <p className="text-3xl font-bold text-blue-400 mt-2">R$ 0,00</p>
        </div>
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-sm">
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">A Receber Pendente</p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">R$ 0,00</p>
        </div>
      </div>

      <ConsignmentsList />
    </div>
  );
}
