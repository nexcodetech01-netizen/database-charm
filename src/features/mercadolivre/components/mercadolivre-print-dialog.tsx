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
  Info
} from "lucide-react";
import { toast } from "sonner";
import { labelaryService } from "@/features/printing/services/labelary.service";
import { printManager } from "@/features/printing/services/print.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      size: "100x150 mm", // Padrão ML
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
            title: "Etiqueta",
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
              title: index === 0 ? "Etiqueta" : "DANFE",
            };
            return await prepareBlock(block, labelData);
          })
        );
        setBlocks(preparedBlocks);
        setActiveTab("block-0");
      }
    } catch (error) {
      console.error("[ML_PRINT_PROCESS_ERROR]:", error);
      toast.error("Erro ao processar documentos.");
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
          toast.info(`Enviando ZPL bruto...`);
        }
        toast.success(`${block.type === 'label' ? 'Etiqueta' : 'DANFE'} enviada.`);
      } else {
        throw new Error(result.message || "Erro ao enviar impressão.");
      }
    } catch (error) {
      toast.error("Falha ao imprimir: " + (error instanceof Error ? error.message : "Erro"));
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
      a.download = `${block.type === 'label' ? 'etiqueta' : 'danfe'}-${labelData?.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (block.zpl) {
      const blob = new Blob([block.zpl], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${block.type === 'label' ? 'etiqueta' : 'danfe'}-${labelData?.id}.zpl`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const labelsCount = blocks.filter(b => b.type === 'label').length;
  const danfesCount = blocks.filter(b => b.type === 'danfe').length;

  if (!open) return null;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[98vw] h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl rounded-xl bg-white dark:bg-slate-950">
        {/* 1. HEADER */}
        <div className="relative px-6 py-4 bg-white dark:bg-slate-900 border-b shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white leading-none">
                Printing Center - Mercado Livre
              </DialogTitle>
              <p className="text-[12px] text-slate-500 mt-1 font-medium">
                Gerencie e imprima etiquetas e DANFE.
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white rounded-md h-8 w-8 transition-colors"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              <p className="text-base text-slate-500 font-semibold tracking-wide">PROCESSANDO DOCUMENTOS...</p>
            </div>
          ) : blocks.length > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
              {/* 2. ABAS */}
              <div className="px-6 py-2 bg-white dark:bg-slate-900 border-b shrink-0 shadow-sm flex items-center justify-between">
                <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border">
                  {blocks.map((block) => (
                    <TabsTrigger 
                      key={block.id} 
                      value={block.id}
                      className={cn(
                        "data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all px-4 h-8 text-xs font-semibold rounded-md",
                        "flex items-center gap-2"
                      )}
                    >
                      {block.type === 'label' ? <Package className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                      {block.type === 'label' ? `Etiqueta (${labelsCount})` : `DANFE (${danfesCount})`}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* 3. LAYOUT (ESQUERDA 260px / DIREITA FLEX) */}
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {blocks.map((block) => {
                  const isSelected = activeTab === block.id;
                  if (!isSelected) return null;

                  return (
                    <div key={block.id} className="flex-1 flex overflow-hidden">
                      {/* 4. COLUNA ESQUERDA (260px) */}
                      <aside className="w-[260px] border-r bg-white dark:bg-slate-900 p-6 flex flex-col gap-6 shrink-0 overflow-y-auto">
                        <div>
                          <h4 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-4">Informações</h4>
                          <div className="space-y-3">
                            {[
                              { label: 'Tipo', value: block.type === 'label' ? 'Etiqueta ML' : 'DANFE Simplificado' },
                              { label: 'Documento', value: block.zpl ? 'ZPL' : 'PDF' },
                              { label: 'Formato', value: block.stats?.size || '100x150 mm' },
                              { label: 'Origem', value: 'Mercado Livre' },
                              { label: 'Status', value: 'Pronto', valueClass: 'text-blue-600 font-bold' }
                            ].map((item, idx) => (
                              <div key={idx} className="flex items-center text-[11px] group">
                                <span className="text-slate-500 shrink-0">{item.label}</span>
                                <div className="flex-1 border-b border-dotted border-slate-200 dark:border-slate-800 mx-1.5 mb-0.5" />
                                <span className={cn("font-semibold text-slate-900 dark:text-slate-100 text-right shrink-0", item.valueClass)}>
                                  {item.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                          <h4 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-4">Status</h4>
                          {block.previewUrl ? (
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100/50 dark:border-emerald-800/50">
                              <CheckCircle2 className="h-4 w-4" />
                              <span className="text-[11px] font-bold">Preview pronto</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-[11px] font-bold">Preview OFF</span>
                              </div>
                              <p className="text-[10px] text-slate-500 leading-tight font-medium">
                                Impressão ZPL segue disponível.
                              </p>
                            </div>
                          )}
                        </div>
                      </aside>

                      {/* 5. COLUNA DIREITA (FLEX) */}
                      <main className="flex-1 bg-slate-100 dark:bg-slate-950 p-4 flex flex-col min-h-0 relative">
                        {/* 6. BOTÕES DO DOCUMENTO ATIVO (SOBREPOSTOS OU NO TOPO) */}
                        <div className="flex items-center justify-between mb-3 shrink-0">
                          <div className="flex items-center gap-2">
                             <h4 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Visualização</h4>
                             {block.previewUrl && <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[9px] font-bold">LIVE</span>}
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              className="h-8 px-3 font-bold text-[10px] bg-white dark:bg-slate-900 border-slate-200 hover:bg-slate-50 transition-all rounded shadow-sm"
                              onClick={() => handleDownloadBlock(block)}
                            >
                              <Download className="h-3 w-3 mr-1.5" /> Baixar {block.type === 'label' ? 'Etiqueta' : 'DANFE'}
                            </Button>
                            <Button 
                              className="h-8 px-3 font-bold text-[10px] bg-blue-600 hover:bg-blue-700 text-white transition-all rounded shadow-md"
                              onClick={() => handlePrintBlock(block)}
                            >
                              <Printer className="h-3 w-3 mr-1.5" /> Imprimir {block.type === 'label' ? 'Etiqueta' : 'DANFE'}
                            </Button>
                          </div>
                        </div>

                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg shadow-inner border border-slate-200/60 dark:border-slate-800 overflow-hidden flex flex-col">
                          {block.previewUrl ? (
                            <iframe
                              src={block.previewUrl}
                              className="w-full h-full"
                              title={block.title}
                            />
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30 dark:bg-slate-900/30">
                              <div className="bg-white dark:bg-slate-800 p-4 rounded-full mb-4 text-slate-200 dark:text-slate-700 shadow-sm border border-slate-100 dark:border-slate-700">
                                <Eye className="h-[36px] w-[36px]" />
                              </div>
                              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5">
                                Preview indisponível
                              </h3>
                              <p className="text-[11px] text-slate-500 max-w-[240px] leading-relaxed font-medium">
                                O serviço Labelary está offline. Download ZPL e impressão direta continuam ativos.
                              </p>
                            </div>
                          )}
                        </div>
                      </main>
                    </div>
                  );
                })}
              </div>
                    </div>
                  );
                })}
              </div>
            </Tabs>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
              <div className="bg-slate-100 dark:bg-slate-800 p-8 rounded-full">
                <AlertCircle className="h-12 w-12 text-slate-400" />
              </div>
              <p className="text-xl text-slate-600 dark:text-slate-400 font-bold">Nenhum documento encontrado.</p>
              <Button variant="outline" size="lg" className="rounded-xl px-8" onClick={() => onOpenChange(false)}>Voltar ao Dashboard</Button>
            </div>
          )}
        </div>

        {/* 7. RODAPÉ SIMPLIFICADO */}
        <DialogFooter className="px-8 py-5 bg-white dark:bg-slate-900 border-t shrink-0 flex items-center justify-between sm:justify-between">
          <div className="flex-1 flex justify-start">
            {blocks.length > 1 && (
              <Button 
                variant="default" 
                className="bg-slate-900 hover:bg-black text-white px-8 h-12 font-bold text-sm rounded-xl shadow-lg transition-all" 
                onClick={handlePrintAll}
                disabled={isPrinting || isLoading}
              >
                <Printer className="mr-3 h-5 w-5" />
                Imprimir Todos
              </Button>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            className="h-12 px-8 font-bold text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
