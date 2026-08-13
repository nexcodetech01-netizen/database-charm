import { createFileRoute } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { ResellersList } from '@/features/consignment/components/resellers-list';

export const Route = createFileRoute('/_authenticated/revendedores')({
  component: ResellersPage,
});

function ResellersPage() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-blue-500" />
        <h1 className="text-3xl font-bold text-white tracking-tight">Revendedores</h1>
      </div>

      <ResellersList />
    </div>
  );
}
