import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/features/rbac";
import { useFiscalDocuments, useFiscalRealtime } from "@/features/fiscal/v2/hooks/use-fiscal";
import { FiscalEnvironmentBanner } from "@/features/fiscal/v2/components/fiscal-environment";
import { FiscalFilters } from "@/features/fiscal/v2/components/fiscal-filters";
import { FiscalTable } from "@/features/fiscal/v2/components/fiscal-table";
import { FiscalTabs } from "@/features/fiscal/v2/components/fiscal-tabs";
import { IssueNfeDialog } from "@/features/fiscal/v2/components/issue-nfe-dialog";
import { FiscalDetailsSheet } from "@/features/fiscal/v2/components/fiscal-details-sheet";
import type { NfeStatus } from "@/features/fiscal/v2/functions/fiscal.functions";

export const Route = createFileRoute("/_authenticated/fiscal/notas")({
  beforeLoad: requirePermission("fiscal.view"),
  component: FiscalNotasPage,
});

function FiscalNotasPage() {
  const { company } = Route.useRouteContext();
  useFiscalRealtime(company.id);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      status: status === "all" ? undefined : (status as NfeStatus),
      search: search.trim() || undefined,
      limit: 100,
    }),
    [status, search],
  );

  const list = useFiscalDocuments(filters);

  return (
    <PageLayout
      title="Fiscal"
      description="Todas as NF-e emitidas pela empresa."
      showBreadcrumb={false}
      actions={
        <Button onClick={() => setIssueOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Emitir NF-e
        </Button>
      }
    >
      <FiscalEnvironmentBanner />
      <FiscalTabs />
      <FiscalFilters
        status={status}
        onStatusChange={setStatus}
        search={search}
        onSearchChange={setSearch}
      />
      <FiscalTable documents={list.data} isLoading={list.isLoading} onSelect={setSelectedId} />
      <IssueNfeDialog
        open={issueOpen}
        onOpenChange={setIssueOpen}
        onIssued={(doc) => setSelectedId(doc.id)}
      />
      <FiscalDetailsSheet
        documentId={selectedId}
        open={Boolean(selectedId)}
        onOpenChange={(v) => !v && setSelectedId(null)}
      />
    </PageLayout>
  );
}
