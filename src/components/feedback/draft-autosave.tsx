import { Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// OFFLINE-001 — Indicador discreto + diálogo de recuperação.
// Portalizado: pode ser renderizado em qualquer ponto do formulário.

interface RecoveryProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  updatedAt: number | null;
  onRestore: () => void;
  onDiscard: () => void;
}

interface Props {
  savedAt: number | null;
  recovery?: RecoveryProps;
}

export function DraftAutosave({ savedAt, recovery }: Props) {
  return (
    <>
      {savedAt ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur"
        >
          <Check className="h-3.5 w-3.5 text-emerald-500" />
          Rascunho salvo automaticamente
        </div>
      ) : null}

      {recovery ? (
        <AlertDialog open={recovery.open} onOpenChange={recovery.onOpenChange}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{recovery.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {recovery.description}
                {recovery.updatedAt
                  ? ` Salvo em ${new Date(recovery.updatedAt).toLocaleString("pt-BR")}.`
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={recovery.onDiscard}>
                Descartar
              </AlertDialogCancel>
              <AlertDialogAction onClick={recovery.onRestore}>
                Continuar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </>
  );
}
