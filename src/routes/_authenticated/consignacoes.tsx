import { createFileRoute, Outlet } from '@tanstack/react-router';
import { ConsignmentsList } from '@/features/consignment/components/consignments-list';

export const Route = createFileRoute('/_authenticated/consignacoes')({
  component: ConsignmentsLayout,
});

function ConsignmentsLayout() {
  return (
    <>
      <ConsignmentsList />
      <Outlet />
    </>
  );
}
