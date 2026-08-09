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
  CheckCircle2,
  X,
  Info,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { labelaryService } from "@/features/printing/services/labelary.service";
import { printManager } from "@/features/printing/services/print.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ZPLBlock {
  id: string;
  zpl: string;
  type: "label" | "danfe";
  title: string;
  blob?: Blob;
  previewUrl?: string;
  stats?: {
    format: string;
    size: string;
    commands: number;
    encoding: string;
  };
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

  const extractZPLStats = (zpl: string) => {
    return {
      format: "ZPL II",
      size: "100x150mm", // Padrão ML
      commands: (zpl.match(/\^/g) || []).length,
      encoding: "UTF-8"
    };
  };

  const prepareBlock = async (block: ZPLBlock, source: NonNullable<MercadoLivrePrintDialogProps["labelData"]>): Promise<ZPLBlock> => {
    let blob: Blob | undefined;
    let previewUrl: string | undefined;
    
    try {
      if (source.type === "pdf") {
        const byteCharacters = atob(source.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: "application/pdf" });
      } else {
        console.log(`[ML_PRINT_DEBUG] Requesting PDF from Labelary for ${block.id}`);
        blob = await labelaryService.convertToPdf({
          id: source.id + "_" + block.id,
          zpl: block.zpl,
        });
      }

      if (blob) {
        previewUrl = URL.createObjectURL(blob);
      }
    } catch (error) {
      console.error(`[ML_PRINT_BLOCK_ERROR] ${block.id}:`, error);
    }

    return {
      ...block,
      blob,
      previewUrl,
      stats: block.zpl ? extractZPLStats(block.zpl) : undefined
    };
  };

  const processLabelData = useCallback(async () => {
    if (!labelData) return;
    
    const content = labelData.content || "";
    setIsLoading(true);

    try {
      let zplBlocks: string[] = [];
      
      if (labelData.type === "zpl") {
        const regex = /\^XA[\s\S]*?\^XZ/g;
        zplBlocks = content.match(regex) || [];
      }

      if (zplBlocks.length === 0) {
        const trimmedContent = content.trim();
        if (trimmedContent.length > 0 || labelData.type === "pdf") {
          const block: ZPLBlock = {
            id: "block-0",
            zpl: labelData.type === "zpl" ? content : "",
            type: "label",
            title: "Etiqueta de envio",
          };
          
          const prepared = await prepareBlock(block, labelData);
          setBlocks([prepared]);
          setActiveTab("block-0");
        }
      } else {
        const preparedBlocks = await Promise.all(
          zplBlocks.map(async (zpl, index) => {
            const block: ZPLBlock = {
              id: `block-${index}`,
              zpl,
              type: index === 0 ? "label" : "danfe",
              title: index === 0 ? "Etiqueta de envio" : "DANFE Simplificado",
            };
            return await prepareBlock(block, labelData);
          })
        );
        setBlocks(preparedBlocks);
        setActiveTab("block-0");
      }
    } catch (error) {
      console.error("[ML_PRINT_PROCESS_ERROR]:", error);
      toast.error("Erro ao processar documentos de impressão.");
    } finally {
      setIsLoading(false);
    }
  }, [labelData]);

  useEffect(() => {
    if (open && labelData) {
      processLabelData();
    } else {
      blocks.forEach(b => {
        if (b.previewUrl) URL.revokeObjectURL(b.previewUrl);
      });
      setBlocks([]);
    }
  }, [open, labelData, processLabelData]);

  const handlePrintBlock = async (block: ZPLBlock) => {
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
        if (block.blob) {
          const url = URL.createObjectURL(block.blob);
          const printWindow = window.open(url);
          if (printWindow) {
            printWindow.print();
          }
        } else if (block.zpl) {
          toast.info(`Enviando ZPL bruto para a impressora...`);
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
      await new Promise(r => setTimeout(r, 500));
    }
  };

  const handleDownloadBlock = (block: ZPLBlock) => {
    if (block.blob) {
      const url = URL.createObjectURL(block.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${block.type === 'label' ? 'etiqueta' : 'danfe'}-ml-${labelData?.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (block.zpl) {
      const blob = new Blob([block.zpl], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${block.type === 'label' ? 'etiqueta' : 'danfe'}-ml-${labelData?.id}.zpl`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const labelsCount = blocks.filter(b => b.type === 'label').length;
  const danfesCount = blocks.filter(b => b.type === 'danfe').length;

  if (!open) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-white/10 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-blue-400" />
              <DialogTitle className="text-lg font-semibold m-0">
                Printing Center - Mercado Livre
              </DialogTitle>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Gerencie e imprima etiquetas e DANFE.
            </p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-slate-500 font-medium">Processando documentos...</p>
            </div>
          ) : blocks.length > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              <div className="px-6 py-2 bg-white dark:bg-slate-900 border-b shrink-0">
                <TabsList className="bg-slate-100 dark:bg-slate-800 p-1">
                  {blocks.map((block) => (
                    <TabsTrigger 
                      key={block.id} 
                      value={block.id}
                      className={cn(
                        "data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all px-4 h-8 text-xs font-medium",
                        "flex items-center gap-2"
                      )}
                    >
                      {block.type === 'label' ? <Package className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      {block.type === 'label' ? `Etiqueta (${labelsCount})` : `DANFE (${danfesCount})`}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 flex min-h-0 overflow-hidden">
                {blocks.map((block) => {
                  const isSelected = activeTab === block.id;
                  if (!isSelected) return null;

                  return (
                    <div key={block.id} className="flex-1 flex overflow-hidden">
                      {/* ESQUERDA - INFORMAÇÕES */}
                      <aside className="w-[300px] border-r bg-white dark:bg-slate-900 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
                        <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                          <CardHeader className="p-4 border-b bg-slate-50 dark:bg-slate-800/50">
                            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                              Informações
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 space-y-4">
                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">Tipo</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{block.type === 'label' ? 'Etiqueta ML' : 'DANFE Simplificado'}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">Formato</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{block.stats?.format || 'PDF/ZPL'}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">Tamanho</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{block.stats?.size || 'Automático'}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">Comandos</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{block.stats?.commands || '-'}</span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500">Codificação</span>
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{block.stats?.encoding || 'UTF-8'}</span>
                              </div>
                            </div>

                            <div className="pt-4 border-t">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Status</p>
                              {block.previewUrl ? (
                                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span className="text-xs font-medium">Preview disponível</span>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                    <AlertCircle className="h-4 w-4" />
                                    <span className="text-xs font-medium">Preview indisponível</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 leading-relaxed">
                                    Você ainda pode imprimir normalmente.
                                  </p>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>

                        <div className="mt-auto space-y-2 pt-4">
                          <Button 
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-10 shadow-sm"
                            onClick={() => handlePrintBlock(block)}
                            disabled={isPrinting || (!block.blob && !block.zpl)}
                          >
                            <Printer className="mr-2 h-4 w-4" />
                            Imprimir {block.type === 'label' ? 'Etiqueta' : 'DANFE'}
                          </Button>
                          <Button 
                            variant="outline"
                            className="w-full h-10 shadow-sm"
                            onClick={() => handleDownloadBlock(block)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Baixar {block.type === 'label' ? 'Etiqueta' : 'DANFE'}
                          </Button>
                        </div>
                      </aside>

                      {/* DIREITA - PREVIEW */}
                      <main className="flex-1 bg-slate-100 dark:bg-slate-950 p-6 flex flex-col min-h-0">
                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg shadow-inner border overflow-hidden flex flex-col">
                          {block.previewUrl ? (
                            <iframe
                              src={block.previewUrl}
                              className="w-full h-full"
                              title={block.title}
                            />
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50 dark:bg-slate-900/50">
                              <div className="bg-slate-200 dark:bg-slate-800 p-4 rounded-full mb-4">
                                <Eye className="h-8 w-8 text-slate-400" />
                              </div>
                              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
                                Preview indisponível
                              </h3>
                              <p className="text-sm text-slate-500 max-w-[280px] leading-relaxed mb-6">
                                O serviço de conversão (Labelary) está indisponível. Você ainda pode imprimir ou baixar o ZPL.
                              </p>
                              <div className="flex gap-3">
                                <Button variant="outline" size="sm" onClick={() => handleDownloadBlock(block)}>
                                  <Download className="h-4 w-4 mr-2" /> Baixar ZPL
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handlePrintBlock(block)}>
                                  <Printer className="h-4 w-4 mr-2" /> Imprimir ZPL
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </main>
                    </div>
                  );
                })}
              </div>
            </Tabs>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-full">
                <AlertCircle className="h-10 w-10 text-red-500" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium">Nenhum documento encontrado.</p>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Voltar</Button>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <DialogFooter className="px-6 py-4 bg-white dark:bg-slate-900 border-t shrink-0 flex flex-wrap gap-3 items-center justify-between sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {blocks.length > 1 && (
              <Button 
                variant="default" 
                className="bg-blue-600 hover:bg-blue-700 shadow-md h-10 px-6 font-medium" 
                onClick={handlePrintAll}
                disabled={isPrinting || isLoading}
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Todos
              </Button>
            )}
            
            {blocks.map((block) => {
              if (activeTab !== block.id) return null;
              return (
                <React.Fragment key={`footer-${block.id}`}>
                  <Button 
                    variant={blocks.length > 1 ? "outline" : "default"}
                    className={cn(
                      "h-10 px-6 font-medium",
                      blocks.length === 1 && "bg-blue-600 hover:bg-blue-700"
                    )}
                    onClick={() => handlePrintBlock(block)}
                    disabled={isPrinting || isLoading}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Imprimir {block.type === 'label' ? 'Etiqueta' : 'DANFE'}
                  </Button>
                  
                  {block.type === 'label' && danfesCount > 0 && (
                    <Button 
                      variant="outline"
                      className="h-10 px-6 font-medium border-slate-200"
                      onClick={() => {
                        const danfe = blocks.find(b => b.type === 'danfe');
                        if (danfe) setActiveTab(danfe.id);
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Imprimir DANFE
                    </Button>
                  )}

                  {block.type === 'danfe' && labelsCount > 0 && (
                    <Button 
                      variant="outline"
                      className="h-10 px-6 font-medium border-slate-200"
                      onClick={() => {
                        const label = blocks.find(b => b.type === 'label');
                        if (label) setActiveTab(label.id);
                      }}
                    >
                      <Package className="mr-2 h-4 w-4" />
                      Imprimir Etiqueta
                    </Button>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          
          <div className="flex gap-2">
            {blocks.length > 1 && (
              <Button 
                variant="ghost" 
                className="text-slate-500 hover:text-slate-900 h-10"
                onClick={() => {
                  blocks.forEach(b => handleDownloadBlock(b));
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar Todos
              </Button>
            )}
            <Button variant="ghost" className="h-10 text-slate-500" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
