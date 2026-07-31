import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Printer } from "lucide-react";
import { exportSessionReportPDF } from "../lib/session-pdf";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cashService } from "../services/cash.service";
import { SessionReport } from "./session-report";

interface Props {
  sessionId: string | null;
  companyName: string;
  onOpenChange: (o: boolean) => void;
}

export function ReportDialog({ sessionId, companyName, onOpenChange }: Props) {
  const { data } = useQuery({
    queryKey: ["cash", "report", sessionId],
    queryFn: async () => {
      const session = await cashService.getSession(sessionId!);
      if (!session) return null;
      const summary = await cashService.computeSummary(session);
      const movements = await cashService.listMovements(session.id);
      return { session, summary, movements };
    },
    enabled: !!sessionId,
  });

  return (
    <Dialog open={!!sessionId} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Relatório de fechamento</DialogTitle>
        </DialogHeader>
        {data ? (
          <SessionReport
            session={data.session}
            summary={data.summary}
            companyName={companyName}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        )}
        <DialogFooter className="no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              data &&
              void exportSessionReportPDF(data.session, data.summary, companyName).catch(
                () => toast.error("Falha ao gerar o PDF do fechamento."),
              )
            }
            disabled={!data}
            className="gap-2"
          >
            <FileDown className="h-4 w-4" /> Exportar PDF
          </Button>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
