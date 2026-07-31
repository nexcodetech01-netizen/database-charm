import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ListSkeleton } from "@/components/layout";
import { useFiscalDocument } from "../hooks/use-fiscal";
import { FiscalDetails } from "./fiscal-details";

/**
 * Sprint 009 — Painel lateral com detalhes + timeline da NF-e.
 * Substitui a navegação para /fiscal/notas/:id no fluxo cotidiano.
 */
interface Props {
  documentId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function FiscalDetailsSheet({ documentId, open, onOpenChange }: Props) {
  const detail = useFiscalDocument(open && documentId ? documentId : undefined);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes da NF-e</SheetTitle>
          <SheetDescription>
            Status, timeline e artefatos oficiais atualizados em tempo real.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {!documentId ? null : detail.isLoading || !detail.data ? (
            <ListSkeleton rows={4} />
          ) : (
            <FiscalDetails
              document={detail.data.document}
              events={detail.data.events}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
