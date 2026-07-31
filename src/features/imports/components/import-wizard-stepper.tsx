import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { ImportWizardStep } from "../types";

const STEPS: { id: ImportWizardStep; label: string; description: string }[] = [
  { id: "select", label: "Selecionar", description: "Escolha o arquivo" },
  { id: "validate", label: "Validar", description: "Verificar formato" },
  { id: "preview", label: "Pré-visualizar", description: "Revisar dados" },
  { id: "import", label: "Importar", description: "Executar" },
  { id: "result", label: "Resultado", description: "Relatório final" },
];

/**
 * Stepper visual do fluxo de importação. Sem lógica de transição.
 */
export function ImportWizardStepper({
  current,
}: {
  current: ImportWizardStep;
}) {
  const currentIdx = STEPS.findIndex((s) => s.id === current);

  return (
    <Card>
      <CardContent className="p-4">
        <ol className="flex flex-wrap items-center gap-2">
          {STEPS.map((step, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            return (
              <li key={step.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full border text-xs font-semibold",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-primary/10 text-primary",
                    !done && !active && "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="hidden text-left sm:block">
                  <div
                    className={cn(
                      "text-xs font-medium",
                      active ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {step.description}
                  </div>
                </div>
                {idx < STEPS.length - 1 ? (
                  <div className="mx-1 h-px w-6 bg-border sm:w-10" />
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

export { STEPS as IMPORT_WIZARD_STEPS };
