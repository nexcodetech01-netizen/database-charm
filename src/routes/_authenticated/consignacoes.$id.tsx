import { createFileRoute } from '@tanstack/react-router';
import { ConsignmentDetails } from '@/features/consignment/components/consignment-details';

export const Route = createFileRoute('/_authenticated/consignacoes/$id')({
  component: ConsignmentDetails,
});
