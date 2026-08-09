import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Upload
} from "lucide-react";
import { toast } from "sonner";
import { labelaryService } from "@/features/printing/services/labelary.service";
import { printManager } from "@/features/printing/services/print.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PrinterSelector } from "@/features/printing/components/PrinterSelector";
import { LabelPreview } from "@/features/printing/components/LabelPreview";
import { detectZPLDimensions, parseZPLBlocks } from "../lib/zpl-parser";

interface DocumentBlock {
  id: string;
  zpl?: string;
  pdf?: string;
  image?: string;
  type: "label" | "danfe" | "comprovante";
  title: string;
  blob?: Blob;
  previewUrl?: string;
  stats?: {
    format: string;
    size: string;
    commands?: number;
    encoding?: string;
  };
}

interface ShippingLabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelData: {
    type: "pdf" | "zpl" | "image";
    format?: "png" | "jpg";
    content: string; // Base64 ou texto bruto
    id: string;
    origin?: string; // Ex: 'Mercado Livre', 'SuperFrete'
  } | null;
}


export function ShippingLabelPrintDialog({
  open,
  onOpenChange,
  labelData,
}: ShippingLabelPrintDialogProps) {
  const [blocks, setBlocks] = useState<DocumentBlock[]>([]);
  const [activeTab, setActiveTab] = useState<string>("block-0");
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportZPL = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      setIsLoading(true);
      try {
        const validBlocks = parseZPLBlocks(content);
        
        console.log(`[ZPL_IMPORT] Blocos válidos encontrados: ${validBlocks.length}`);

        if (validBlocks.length === 0) {
          const trimmedContent = content.trim();
          if (trimmedContent.length > 0) {
            const block: DocumentBlock = {
              id: "block-0",
              zpl: content,
              type: "label",
              title: "Etiqueta",
            };
            const prepared = await prepareBlock(block, { type: "zpl", content, id: file.name });
            setBlocks([prepared]);
            setActiveTab("block-0");
          }
        } else {
          const preparedBlocks = await Promise.all(
            validBlocks.map(async (item, index) => {
              const block: DocumentBlock = {
                id: `block-${index}`,
                zpl: item.zpl,
                type: item.type,
                title: item.type === "label" ? "Etiqueta" : "DANFE",
              };

              return await prepareBlock(block, { type: "zpl", content, id: file.name });
            })
          );
          setBlocks(preparedBlocks);
          setActiveTab("block-0");
        }
        toast.success("ZPL importado com sucesso.");
        toast.success("ZPL importado com sucesso.");
      } catch (error) {
        console.error("[ZPL_IMPORT_ERROR]:", error);
        toast.error("Erro ao processar arquivo ZPL.");
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = "";
  };

  const extractZPLStats = (zpl: string) => {
    const { width, height } = detectZPLDimensions(zpl);
    return {
      format: "ZPL II",
      size: `${width * 25.4}x${height * 25.4} mm`,
      commands: (zpl.match(/\^/g) || []).length,
      encoding: "UTF-8"
    };
  };

  const prepareBlock = async (block: DocumentBlock, source: NonNullable<ShippingLabelPrintDialogProps["labelData"]>): Promise<DocumentBlock> => {
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
      } else if (source.type === "image") {
        const type = source.format === "png" ? "image/png" : "image/jpeg";
        const byteCharacters = atob(source.content);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type });
      }
      // O ZPL não é convertido aqui agora. A conversão ocorre sob demanda no LabelPreview.

      if (blob) {
        previewUrl = URL.createObjectURL(blob);
      }
    } catch (error) {
      console.error(`[PRINT_BLOCK_ERROR] ${block.id}:`, error);
    }

    return {
      ...block,
      blob,
      previewUrl,
      stats: block.zpl ? extractZPLStats(block.zpl) : {
        format: source.type.toUpperCase(),
        size: "A4 / Térmica",
      }
    };
  };


  const processLabelData = useCallback(async () => {
    if (!labelData) return;
    
    const content = labelData.content || "";
    setIsLoading(true);

    try {
      let validBlocks: Array<{ zpl: string; type: "label" | "danfe" }> = [];
      
      if (labelData.type === "zpl") {
        validBlocks = parseZPLBlocks(content);
        console.log(`[ShippingLabelPrintDialog] Total de blocos válidos: ${validBlocks.length}`);
      }

      if (validBlocks.length === 0) {
        const trimmedContent = content.trim();
        if (trimmedContent.length > 0 || labelData.type === "pdf") {
          const block: DocumentBlock = {
            id: "block-0",
            zpl: labelData.type === "zpl" ? content : "",
            pdf: labelData.type === "pdf" ? content : "",
            image: labelData.type === "image" ? content : "",
            type: "label",
            title: "Etiqueta",
          };

          const prepared = await prepareBlock(block, labelData);
          setBlocks([prepared]);
          setActiveTab("block-0");
        }
      } else {
        const preparedBlocks = await Promise.all(
          validBlocks.map(async (item, index) => {
            const block: DocumentBlock = {
              id: `block-${index}`,
              zpl: item.zpl,
              type: item.type,
              title: item.type === "label" ? "Etiqueta" : "DANFE",
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

  const handlePrintBlock = async (block: DocumentBlock) => {
    setIsPrinting(true);
    try {
      // Prioridade absoluta: Se for ZPL, enviar BRUTO
      let strategy: any = "PDF";
      if (block.zpl) strategy = "RAW";
      if (labelData?.type === "image") strategy = "BROWSER";

      const result = await printManager.print(
        {
          id: labelData?.id + "_" + block.id,
          zpl: block.zpl || undefined,
          pdf: block.pdf || undefined,
          image: block.image || undefined,
          content: block.zpl ? undefined : labelData?.content,
          format: labelData?.type === "image" ? (labelData.format?.toUpperCase() as any) : (labelData?.type.toUpperCase() as any)
        },
        { 
          strategy: strategy,
          type: 'LABEL',
          printerId: selectedPrinterId || undefined
        }
      );


      if (result.success) {
        if (block.zpl) {
          toast.success(`ZPL enviado para fila enterprise: ${block.title}`);
        } else if (block.blob) {
          const url = URL.createObjectURL(block.blob);
          const printWindow = window.open(url);
          if (printWindow) {
            printWindow.print();
          }
          toast.success(`${block.title} aberta para impressão.`);
        }
      } else {
        throw new Error(result.message || "Erro ao enfileirar impressão.");
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

  const handleDownloadBlock = (block: DocumentBlock) => {
    if (block.blob) {
      const url = URL.createObjectURL(block.blob);
      const a = document.createElement("a");
      a.href = url;
      const extension = labelData?.type === "pdf" || block.zpl ? "pdf" : (labelData?.format || "png");
      a.download = `${block.type === 'label' ? 'etiqueta' : 'danfe'}-${labelData?.id}.${extension}`;
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
                Printing Center - {labelData?.origin || 'Logística'}
              </DialogTitle>
              <p className="text-[12px] text-slate-500 mt-1 font-medium">
                Gerencie e imprima etiquetas e DANFE.
              </p>
            </div>
          </div>
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
                      {block.type === 'label' ? "Etiqueta" : "DANFE"}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              {/* 3. LAYOUT (ESQUERDA 265px / DIREITA FLEX) */}
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {blocks.map((block) => {
                  const isSelected = activeTab === block.id;
                  if (!isSelected) return null;

                  return (
                    <div key={block.id} className="flex-1 flex overflow-hidden">
                      {/* 4. COLUNA ESQUERDA (265px) */}
                      <aside className="w-[265px] border-r bg-white dark:bg-slate-900 p-4 flex flex-col gap-4 shrink-0 overflow-visible">
                        <div>
                          <h4 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-3">Informações</h4>
                          <div className="space-y-2.5">
                            {[
                              { label: 'Tipo', value: block.type === 'label' ? 'Etiqueta' : block.type === 'danfe' ? 'DANFE' : 'Documento' },
                              { label: 'Documento', value: labelData?.type.toUpperCase() || '---' },
                              { label: 'Formato', value: block.stats?.size || 'Auto' },
                              { label: 'Origem', value: labelData?.origin || 'Logística' },
                              { label: 'Status', value: 'Pronto', valueClass: 'text-blue-600 dark:text-blue-400 font-bold' }

                            ].map((item, idx) => (
                              <div key={idx} className="flex items-center text-[10.5px] group">
                                <span className="text-slate-400 shrink-0">{item.label}</span>
                                <div className="flex-1 border-b border-dotted border-slate-200 dark:border-slate-800 mx-1.5 mb-0.5" />
                                <span className={cn("font-bold text-slate-900 dark:text-slate-100 text-right shrink-0", item.valueClass)}>
                                  {item.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                          <h4 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400 mb-3">Status</h4>
                          <div className="flex flex-col gap-2">
                            {block.previewUrl ? (
                              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-[10.5px] uppercase tracking-wider">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                Preview disponível
                              </div>
                             ) : (
                              <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 font-bold text-[10.5px] uppercase tracking-wider">
                                <Info className="h-3 w-3" /> PREVIEW INDISPONÍVEL
                              </div>
                            )}
                            <p className="text-[10px] text-slate-400 leading-tight font-medium">
                              {block.previewUrl 
                                ? "O documento está pronto para visualização e impressão."
                                : "Preview indisponível. Impressão e download continuam disponíveis."
                              }
                            </p>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                           <PrinterSelector 
                              value={selectedPrinterId} 
                              onValueChange={setSelectedPrinterId} 
                           />
                        </div>
                      </aside>

                      {/* 5. COLUNA DIREITA (FLEX) */}
                      <main className="flex-1 bg-slate-50 dark:bg-slate-950 p-2 flex flex-col min-h-0 relative">
                        {/* 6. BOTÕES DO DOCUMENTO ATIVO */}
                        <div className="flex items-center justify-between mb-1.5 shrink-0 px-2 pt-1">
                          <div className="flex items-center gap-2">
                             <h4 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Visualização</h4>
                             {block.previewUrl && <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold tracking-tight">LIVE</span>}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              accept=".zpl,.txt"
                              onChange={handleFileChange}
                            />
                            <Button 
                              variant="outline" 
                              className="h-8 px-4 font-bold text-[10px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition-all rounded-md shadow-sm"
                              onClick={handleImportZPL}
                            >
                              <Upload className="h-3 w-3 mr-2" /> Importar ZPL
                            </Button>
                            <Button 
                              variant="outline" 
                              className="h-8 px-4 font-bold text-[10px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 transition-all rounded-md shadow-sm"
                              onClick={() => handleDownloadBlock(block)}
                            >
                              <Download className="h-3 w-3 mr-2" /> Baixar {block.type === 'label' ? 'Etiqueta' : 'DANFE'}
                            </Button>
                            <Button 
                              className="h-8 px-4 font-bold text-[10px] bg-blue-600 hover:bg-blue-700 text-white transition-all rounded-md shadow-md border-none"
                              onClick={() => handlePrintBlock(block)}
                            >
                              <Printer className="h-3 w-3 mr-2" /> Imprimir {block.type === 'label' ? 'Etiqueta' : 'DANFE'}
                            </Button>
                          </div>
                        </div>

                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg shadow-inner border border-slate-200/60 dark:border-slate-800 overflow-hidden flex flex-col">
                          <LabelPreview 
                            label={{
                              id: block.id,
                              zpl: block.zpl,
                              pdf: block.pdf,
                              image: block.image,
                              width: 4,
                              height: 6,
                              dpmm: 8
                            }} 
                            className="flex-1 border-none min-h-full"
                          />
                        </div>
                      </main>
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
        <div className="h-[52px] px-6 bg-white dark:bg-slate-900 border-t shrink-0 flex items-center justify-between">
          <div>
            {blocks.length > 1 && (
              <Button 
                variant="default" 
                className="bg-slate-900 dark:bg-slate-100 hover:bg-black dark:hover:bg-white text-white dark:text-slate-900 px-5 h-8 font-bold text-[10px] rounded-md shadow-md transition-all border-none" 
                onClick={handlePrintAll}
                disabled={isPrinting || isLoading}
              >
                <Printer className="mr-2 h-3.5 w-3.5" />
                Imprimir Todos
              </Button>
            )}
          </div>
          
          <Button 
            variant="outline" 
            className="h-8 px-5 font-bold text-[10px] text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 rounded-md transition-all"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
