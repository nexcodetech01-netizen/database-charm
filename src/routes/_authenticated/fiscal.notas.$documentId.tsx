import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText } from "lucide-react";
import { PageLayout, ListSkeleton } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/features/rbac";
import {
  useFiscalDocument,
  useFiscalRealtime,
} from "@/features/fiscal/v2/hooks/use-fiscal";
import { FiscalDetails } from "@/features/fiscal/v2/components/fiscal-details";

export const Route = createFileRoute("/_authenticated/fiscal/notas/$documentId")({
  beforeLoad: requirePermission("fiscal.view"),
  component: FiscalDocumentPage,
});

function FiscalDocumentPage() {
  const { company } = Route.useRouteContext();
  const { documentId } = Route.useParams();
  useFiscalRealtime(company.id);
  const detail = useFiscalDocument(documentId);

  return (
    <PageLayout
      title="Detalhes da NF-e"
      description={documentId}
      icon={FileText}
      showBreadcrumb={false}
      actions={
        <Button variant="outline" asChild>
          <Link to="/fiscal/notas">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
          </Link>
        </Button>
      }
    >
      {detail.isLoading ? (
        <ListSkeleton rows={4} />
      ) : detail.data ? (
        <FiscalDetails document={detail.data.document} events={detail.data.events} />
      ) : (
        <p className="text-sm text-muted-foreground">Documento não encontrado.</p>
      )}
    </PageLayout>
  );
}
