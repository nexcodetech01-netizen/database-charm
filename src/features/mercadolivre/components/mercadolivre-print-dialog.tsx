import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { labelaryService } from "@/features/printing/services/labelary.service";
import { printManager } from "@/features/printing/services/print.service";

interface MercadoLivrePrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelData: {
    type: "pdf" | "zpl";
    content: string;
    id: string;
  } | null;
}

export function MercadoLivrePrintDialog({
  open,
  onOpenChange,
  labelData,
}: MercadoLivrePrintDialogProps) {
  const [isPrinting, setIsPrinting] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  React.useEffect(() => {
    if (open && labelData) {
      preparePreview();
    } else {
      setPdfBlob(null);
      setPreviewUrl(null);
    }
  }, [open, labelData]);

  async function preparePreview() {
    if (!labelData) return;
    setLoadingPreview(true);
    try {
      console.log(`[ML_PREVIEW_START] type=${labelData.type} id=${labelData.id}`);
      if (labelData.type === "pdf") {
        const byteCharacters = atob(labelData.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        setPdfBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
      } else {
        console.log(`[ZPL_CONVERSION_START] id=${labelData.id}`);
        const blob = await labelaryService.convertToPdf({
          id: labelData.id,
          zpl: labelData.content,
        });
        console.log(`[ZPL_CONVERSION_SUCCESS] id=${labelData.id} size=${blob.size}`);
        setPdfBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
      }
    } catch (error) {
      console.error("[ML_PREVIEW_ERROR]:", error);
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error(`Falha ao carregar visualização da etiqueta: ${message}`);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handlePrint() {
    if (!pdfBlob || !labelData) return;
    setIsPrinting(true);
    try {
      // PrintManager Enterprise usa LabelData
      const result = await printManager.print(
        {
          id: labelData.id,
          zpl: labelData.type === "zpl" ? labelData.content : undefined,
          // Se for PDF, o printManager ainda não tem uma estratégia de PDF direto no buffer,
          // mas o requisito pede para usar o print.service.ts.
          // Em um ambiente browser real sem QZ, o "imprimir" normalmente abre o print do browser no blob.
          content: labelData.type === "pdf" ? labelData.content : undefined,
        },
        { strategy: "PDF" as any }
      );

      if (result.success) {
        // Como o PrintQueue é assíncrono e estamos no browser sem driver nativo direto,
        // o comportamento padrão de UX para "Imprimir" via PDF no browser é abrir o blob.
        const url = URL.createObjectURL(pdfBlob);
        const printWindow = window.open(url);
        if (printWindow) {
          printWindow.print();
        }
        toast.success("Impressão enviada.");
        onOpenChange(false);
      } else {
        console.error(`[PRINT_SERVICE_ERROR] job=${result.jobId} message=${result.message}`);
        throw new Error(result.message || "A impressora não respondeu corretamente.");
      }
    } catch (error) {
      console.error("[HANDLE_PRINT_ERROR]:", error);
      toast.error("Falha ao imprimir: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    } finally {
      setIsPrinting(false);
    }
  }

  function handleDownload() {
    if (!pdfBlob || !labelData) return;
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `etiqueta-ml-${labelData.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Imprimir Etiqueta Mercado Livre</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 p-4">
          {loadingPreview ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando visualização...</p>
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              className="h-[500px] w-full rounded-sm border bg-white"
              title="Preview da Etiqueta"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-destructive">
              <AlertCircle className="h-10 w-10" />
              <p className="text-sm font-medium">Não foi possível carregar a etiqueta.</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleDownload} disabled={!pdfBlob}>
            <Download className="mr-2 h-4 w-4" />
            Baixar PDF
          </Button>
          <Button onClick={handlePrint} disabled={!pdfBlob || isPrinting}>
            {isPrinting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
