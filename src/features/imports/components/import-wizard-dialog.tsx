import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/layout/empty-state";
import type { ImportSource, ImportWizardStep } from "../types";
import { ImportWizardStepper, IMPORT_WIZARD_STEPS } from "./import-wizard-stepper";
import { ImportPreviewSummaryCard } from "./import-preview-summary";
import { ImportExecutionLogPanel } from "./import-execution-log";

/**
 * Diálogo do fluxo de importação (Selecionar → Validar → Preview →
 * Importar → Resultado). Apenas UI: avança pelos passos sem processar
 * nada real.
 */
export function ImportWizardDialog({
  source,
  open,
  onOpenChange,
}: {
  source: ImportSource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [step, setStep] = useState<ImportWizardStep>("select");

  const currentIdx = IMPORT_WIZARD_STEPS.findIndex((s) => s.id === step);
  const canGoNext = currentIdx < IMPORT_WIZARD_STEPS.length - 1;
  const canGoBack = currentIdx > 0;

  function handleClose(next: boolean) {
    onOpenChange(next);
    if (!next) setStep("select");
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Importar {source?.title ?? "arquivo"}
          </DialogTitle>
          <DialogDescription>
            Fluxo guiado de importação. O processamento real será habilitado nas
            próximas atualizações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ImportWizardStepper current={step} />

          {step === "select" ? (
            <EmptyState
              icon={UploadCloud}
              title="Selecione um arquivo"
              description={
                source
                  ? `Formatos aceitos: ${source.accept}. Nenhum upload real será executado neste momento.`
                  : "Escolha uma fonte no dashboard para começar."
              }
            />
          ) : null}

          {step === "validate" ? (
            <EmptyState
              title="Validando estrutura do arquivo"
              description="Etapa reservada para checagem de layout, colunas obrigatórias e tipos."
            />
          ) : null}

          {step === "preview" ? (
            <ImportPreviewSummaryCard
              summary={{ created: 0, updated: 0, ignored: 0, duplicated: 0, errors: 0 }}
            />
          ) : null}

          {step === "import" ? (
            <ImportExecutionLogPanel
              log={{
                startedAt: null,
                endedAt: null,
                durationMs: null,
                processedRows: 0,
                errors: 0,
              }}
            />
          ) : null}

          {step === "result" ? (
            <EmptyState
              title="Importação simulada"
              description="O relatório final aparecerá aqui após o processamento real ser habilitado."
            />
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="ghost"
            disabled={!canGoBack}
            onClick={() =>
              canGoBack && setStep(IMPORT_WIZARD_STEPS[currentIdx - 1].id)
            }
          >
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancelar
            </Button>
            {canGoNext ? (
              <Button
                onClick={() => setStep(IMPORT_WIZARD_STEPS[currentIdx + 1].id)}
              >
                Avançar
              </Button>
            ) : (
              <Button onClick={() => handleClose(false)}>Concluir</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
