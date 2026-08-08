import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Printer, 
  Download, 
  AlertCircle, 
  Loader2, 
  Package, 
  FileText, 
  Eye,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { labelaryService } from "@/features/printing/services/labelary.service";
import { printManager } from "@/features/printing/services/print.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface ZPLBlock {
  id: string;
  zpl: string;
  type: "label" | "danfe";
  title: string;
  blob?: Blob;
  previewUrl?: string;
}

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
  const [blocks, setBlocks] = useState<ZPLBlock[]>([]);
  const [activeTab, setActiveTab] = useState<string>("block-0");
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const prepareBlock = async (block: ZPLBlock, source: NonNullable<MercadoLivrePrintDialogProps["labelData"]>): Promise<ZPLBlock> => {
    let blob: Blob;
    
    if (source.type === "pdf") {
      const byteCharacters = atob(source.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: "application/pdf" });
    } else {
      // Converter ZPL para PDF via Labelary
      blob = await labelaryService.convertToPdf({
        id: source.id + "_" + block.id,
        zpl: block.zpl,
      });
    }

    return {
      ...block,
      blob,
      previewUrl: URL.createObjectURL(blob)
    };
  };

  const processLabelData = useCallback(async () => {
    if (!labelData) {
      console.log("[ML_PRINT_DEBUG] processLabelData: labelData is null, skipping.");
      return;
    }
    
    const content = labelData.content || "";
    console.log("[ML_PRINT_DEBUG] processLabelData started:", {
      id: labelData.id,
      type: labelData.type,
      contentLength: content.length,
      contentStart: content.substring(0, 100).replace(/\n/g, "\\n")
    });

    setIsLoading(true);

    try {
      let zplBlocks: string[] = [];
      
      if (labelData.type === "zpl") {
        // Regex robusta para capturar blocos ignorando espaços/quebras extras antes de ^XA
        const regex = /\^XA[\s\S]*?\^XZ/g;
        zplBlocks = content.match(regex) || [];
        console.log(`[ML_PRINT_DEBUG] Regex result: ${zplBlocks.length} blocks found.`);
      }

      // Se não detectou blocos ou for PDF, trata como bloco único
      if (zplBlocks.length === 0) {
        console.log("[ML_PRINT_DEBUG] No blocks found via regex, evaluating fallback.");
        const trimmedContent = content.trim();
        if (trimmedContent.length > 0 || labelData.type === "pdf") {
          console.log("[ML_PRINT_DEBUG] Fallback: treating as single block.");
          const block: ZPLBlock = {
            id: "block-0",
            zpl: labelData.type === "zpl" ? content : "",
            type: "label",
            title: "📦 Etiqueta de envio",
          };
          
          const prepared = await prepareBlock(block, labelData);
          setBlocks([prepared]);
          setActiveTab("block-0");
        } else {
          console.log("[ML_PRINT_DEBUG] Fallback failed: content is empty.");
        }
      } else {
        // Múltiplos blocos ZPL
        console.log(`[ML_PRINT_DEBUG] Processing ${zplBlocks.length} multiple blocks.`);
        const preparedBlocks = await Promise.all(
          zplBlocks.map(async (zpl, index) => {
            const block: ZPLBlock = {
              id: `block-${index}`,
              zpl,
              type: index === 0 ? "label" : "danfe",
              title: index === 0 ? "📦 Etiqueta de envio" : "🧾 DANFE Simplificado",
            };
            console.log(`[ML_PRINT_DEBUG] Preparing block-${index}`);
            return await prepareBlock(block, labelData);
          })
        );
        console.log("[ML_PRINT_DEBUG] Multi-block preparation complete.");
        setBlocks(preparedBlocks);
        setActiveTab("block-0");
      }
    } catch (error) {
      console.error("[ML_PRINT_PROCESS_ERROR]:", error);
      if (error instanceof Error) {
        console.error("[ML_PRINT_DEBUG] Stack trace:", error.stack);
      }
      toast.error("Erro ao processar documentos de impressão.");
    } finally {
      setIsLoading(false);
    }
  }, [labelData]);

  useEffect(() => {
    if (open && labelData) {
      processLabelData();
    } else {
      // Cleanup
      blocks.forEach(b => {
        if (b.previewUrl) URL.revokeObjectURL(b.previewUrl);
      });
      setBlocks([]);
    }
  }, [open, labelData, processLabelData]);

  const handlePrintBlock = async (block: ZPLBlock) => {
    if (!block.blob) return;
    setIsPrinting(true);
    try {
      const result = await printManager.print(
        {
          id: labelData?.id + "_" + block.id,
          zpl: block.zpl || undefined,
          content: block.zpl ? undefined : labelData?.content,
        },
        { strategy: "PDF" as any }
      );

      if (result.success) {
        const url = URL.createObjectURL(block.blob);
        const printWindow = window.open(url);
        if (printWindow) {
          printWindow.print();
        }
        toast.success(`Impressão de ${block.title} enviada.`);
      } else {
        throw new Error(result.message || "Erro ao enviar para o gestor de impressão.");
      }
    } catch (error) {
      toast.error("Falha ao imprimir: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintAll = async () => {
    for (const block of blocks) {
      await handlePrintBlock(block);
      // Pequeno delay entre janelas de impressão
      await new Promise(r => setTimeout(r, 500));
    }
  };

  const handleDownloadBlock = (block: ZPLBlock) => {
    if (!block.blob) return;
    const url = URL.createObjectURL(block.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${block.type === 'label' ? 'etiqueta' : 'danfe'}-ml-${labelData?.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;
  
  console.log("[ML_PRINT_DEBUG] Rendering UI. Open:", open, "Blocks:", blocks.length, "ActiveTab:", activeTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl min-h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-blue-600" />
            Printing Center - Mercado Livre
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 py-4">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 border rounded-md border-dashed">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Processando blocos ZPL...</p>
            </div>
          ) : blocks.length > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-4 bg-muted/30 p-2 rounded-lg border">
                <TabsList className="grid grid-cols-2 w-[400px]">
                  {blocks.map((block) => (
                    <TabsTrigger 
                      key={block.id} 
                      value={block.id}
                      className="data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    >
                      {block.type === 'label' ? <Package className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                      {block.id === 'block-0' ? 'Etiqueta' : 'DANFE'}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {blocks.length > 1 && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 py-1">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Multi-Documento Detectado
                  </Badge>
                )}
              </div>

              {blocks.map((block) => (
                <TabsContent key={block.id} value={block.id} className="flex-1 min-h-0 mt-0 focus-visible:ring-0">
                  <div className="h-[450px] w-full border rounded-md overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-inner">
                    {block.previewUrl ? (
                      <iframe
                        src={block.previewUrl}
                        className="h-full w-full"
                        title={block.title}
                      />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-destructive">
                        <AlertCircle className="h-10 w-10" />
                        <p className="text-sm font-medium">Falha ao gerar visualização.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-destructive border rounded-md border-dashed">
              <AlertCircle className="h-10 w-10" />
              <p className="text-sm font-medium">Nenhum documento encontrado.</p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-3 pt-4 border-t">
          <div className="flex-1 flex flex-wrap gap-2">
            {blocks.length > 1 && (
              <Button 
                variant="default" 
                className="bg-blue-600 hover:bg-blue-700" 
                onClick={handlePrintAll}
                disabled={isPrinting || isLoading}
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Ambos
              </Button>
            )}
            
            {blocks.map((block) => {
              const isSelected = activeTab === block.id;
              if (!isSelected && blocks.length > 1) return null;
              
              return (
                <React.Fragment key={block.id}>
                  <Button 
                    variant={blocks.length > 1 ? "outline" : "default"}
                    onClick={() => handlePrintBlock(block)}
                    disabled={isPrinting || isLoading}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    {blocks.length > 1 ? `Imprimir ${block.type === 'label' ? 'Etiqueta' : 'DANFE'}` : 'Imprimir Etiqueta'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleDownloadBlock(block)}
                    disabled={isPrinting || isLoading}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {blocks.length > 1 ? `Baixar ${block.type === 'label' ? 'Etiqueta' : 'DANFE'}` : 'Baixar PDF'}
                  </Button>
                </React.Fragment>
              );
            })}
          </div>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
