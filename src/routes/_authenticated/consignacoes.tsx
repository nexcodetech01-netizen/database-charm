import { createFileRoute } from '@tanstack/react-router';
import { ConsignmentsList } from '@/features/consignment/components/consignments-list';

export const Route = createFileRoute('/_authenticated/consignacoes')({
  component: ConsignmentsList,
});
