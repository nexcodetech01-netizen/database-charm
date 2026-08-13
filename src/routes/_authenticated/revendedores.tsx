import { createFileRoute } from '@tanstack/react-router';
import { ResellersList } from '@/features/consignment/components/resellers-list';

export const Route = createFileRoute('/_authenticated/revendedores')({
  component: ResellersList,
});
