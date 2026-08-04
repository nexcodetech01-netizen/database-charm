import { requirePermission } from "@/features/rbac";
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DownloadCloud, History, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout";
import {
  IMPORT_HISTORY,
  IMPORT_SOURCES,
  ImportHistoryTable,
  ImportSourceCard,
  ImportWizardDialog,
  type ImportSource,
} from "@/features/imports";

export const Route = createFileRoute("/_authenticated/importacoes")({
  beforeLoad: requirePermission("products.create"),
  component: ImportsPage,
});

function ImportsPage() {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeSource, setActiveSource] = useState<ImportSource | null>(null);

  function openWizard(source: ImportSource) {
    setActiveSource(source);
    setWizardOpen(true);
  }

  return (
    <PageLayout
      icon={DownloadCloud}
      title="Importações"
      description="Central única de entrada de dados no NexOS. Toda importação futura passará por aqui."
      actions={
        <Button onClick={() => openWizard(IMPORT_SOURCES[0])}>
          <Upload className="mr-1.5 h-4 w-4" /> Nova importação
        </Button>
      }
    >
      <section aria-labelledby="import-sources-title" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 id="import-sources-title" className="text-sm font-semibold tracking-tight">
              Fontes de importação
            </h2>
            <p className="text-xs text-muted-foreground">
              Escolha o tipo de arquivo ou entidade que deseja importar.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <ImportSourceCard
            source={{
              id: "mercadolivre",
              name: "Mercado Livre",
              description: "Importar pedidos pendentes do Mercado Livre",
              icon: ShoppingBag,
            }}
            onImport={() => {
              window.location.href = "/importacoes/mercado-livre";
            }}
          />
          {IMPORT_SOURCES.map((source) => (
            <ImportSourceCard key={source.id} source={source} onImport={openWizard} />
          ))}
        </div>
      </section>

      <section aria-labelledby="import-history-title" className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <div>
            <h2 id="import-history-title" className="text-sm font-semibold tracking-tight">
              Histórico
            </h2>
            <p className="text-xs text-muted-foreground">
              Toda importação executada fica registrada com arquivo, tipo, data, usuário, registros
              e status.
            </p>
          </div>
        </div>

        <ImportHistoryTable rows={IMPORT_HISTORY} />
      </section>

      <ImportWizardDialog source={activeSource} open={wizardOpen} onOpenChange={setWizardOpen} />
    </PageLayout>
  );
}
