import React, { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Printer, 
  Loader2, 
  Package, 
  FileText, 
  Upload,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { printManager } from "@/features/printing/services/print.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PrinterSelector } from "@/features/printing/components/PrinterSelector";
import { LabelPreview } from "@/features/printing/components/LabelPreview";
import { detectZPLDimensions, parseZPLBlocks } from "../lib/zpl-parser";

interface DocumentBlock {
  id: string;
  zpl?: string;
  /** Base64 (data URL) do PDF, quando o arquivo importado é um PDF em vez de TXT/ZPL. */
  pdf?: string;
  fileName?: string;
  type: "label" | "danfe";
  title: string;
  stats?: {
    format: string;
    size: string;
    commands?: number;
    encoding?: string;
  };
}

interface GenericLabelPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenericLabelPrintDialog({
  open,
  onOpenChange,
}: GenericLabelPrintDialogProps) {
  const [blocks, setBlocks] = useState<DocumentBlock[]>([]);
  const [activeTab, setActiveTab] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportTXT = () => {
    fileInputRef.current?.click();
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    setIsLoading(true);

    // NOVO: suporte a PDF, além do TXT (ZPL) do Mercado Livre. O sistema
    // de impressão já sabia lidar com PDF (`strategy: "PDF"`, usado no
    // fluxo da SuperFrete) — esse importador só nunca tinha sido
    // conectado a isso, ficava restrito a arquivos TXT com comandos ZPL.
    if (isPdf) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) {
          setIsLoading(false);
          toast.error("Não foi possível ler o PDF.");
          return;
        }
        const block: DocumentBlock = {
          id: "block-0",
          pdf: dataUrl,
          fileName: file.name,
          type: "label",
          title: file.name.replace(/\.pdf$/i, "") || "Etiqueta (PDF)",
          stats: {
            format: "PDF",
            size: `${(file.size / 1024).toFixed(0)} KB`,
            encoding: "base64",
          },
        };
        setBlocks([block]);
        setActiveTab("block-0");
        toast.success("PDF importado com sucesso.");
        setIsLoading(false);
      };
      reader.onerror = () => {
        toast.error("Erro ao ler o arquivo PDF.");
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      if (!content) {
        setIsLoading(false);
        return;
      }

      try {
        const validBlocks = parseZPLBlocks(content);
        console.info(`[TXT_IMPORT] Blocos válidos encontrados: ${validBlocks.length}`);

        if (validBlocks.length === 0) {
          const trimmedContent = content.trim();
          if (trimmedContent.length > 0) {
            const block: DocumentBlock = {
              id: "block-0",
              zpl: content,
              type: "label",
              title: "Etiqueta",
              stats: extractZPLStats(content)
            };
            setBlocks([block]);
            setActiveTab("block-0");
          } else {
            toast.error("O arquivo selecionado está vazio.");
          }
        } else {
          const newBlocks = validBlocks.map((item, index) => ({
            id: `block-${index}`,
            zpl: item.zpl,
            type: item.type,
            title: item.type === "label" ? "Etiqueta" : "DANFE",
            stats: extractZPLStats(item.zpl)
          }));
          setBlocks(newBlocks);
          setActiveTab("block-0");
        }
        toast.success("Arquivo importado com sucesso.");
      } catch (error) {
        console.error("[TXT_IMPORT_ERROR]:", error);
        toast.error("Erro ao processar arquivo TXT.");
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
      toast.error("Erro ao ler o arquivo.");
      setIsLoading(false);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const handlePrintBlock = async (block: DocumentBlock) => {
    if (isPrinting) return;
    
    setIsPrinting(true);
    // Usamos um ID estável para o job, combinando o ID da aba para evitar loops.
    // Assim como em ShippingLabelPrintDialog, evitamos timestamps aqui.
    const jobId = `OP-${block.id}`; 
    
    try {
      console.info("[GenericPrint] Iniciando impressão", { blockId: block.id, type: block.type, isPdf: !!block.pdf });

      const result = block.pdf
        ? await printManager.printAndWait(
            { id: jobId, pdf: block.pdf },
            { strategy: "PDF", type: "LABEL", printerId: selectedPrinterId || undefined },
          )
        : await printManager.printAndWait(
            { id: jobId, zpl: block.zpl },
            { strategy: "RAW", type: "LABEL", printerId: selectedPrinterId || undefined },
          );

      if (!result.success) {
        throw new Error(result.message || "Erro ao enfileirar impressão.");
      }

      toast.success(`Impressão enviada com sucesso: ${block.title}`);
    } catch (error) {
      console.error("[GenericPrint] Erro na execução da impressão:", error);
      toast.error("Falha ao imprimir: " + (error instanceof Error ? error.message : "Erro"));
    } finally {
      setIsPrinting(false);
    }
  };

  const currentBlock = blocks.find(b => b.id === activeTab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] w-[95vw] h-[90vh] flex flex-col p-0 border-none shadow-2xl rounded-xl bg-white dark:bg-slate-950">
        <DialogHeader className="px-6 py-4 bg-white dark:bg-slate-900 border-b shrink-0 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-1.5 rounded-lg text-white">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white leading-none">
                Imprimir Etiqueta (Operacional)
              </DialogTitle>
              <p className="text-[12px] text-slate-500 mt-1 font-medium">
                Importe o arquivo TXT (ZPL) ou PDF da etiqueta para imprimir.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-950 overflow-hidden">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
              <p className="text-base text-slate-500 font-semibold">LENDO ARQUIVO...</p>
            </div>
          ) : blocks.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-6">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/30 rounded-full flex items-center justify-center">
                <Upload className="h-10 w-10 text-emerald-600" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Nenhuma etiqueta carregada</h3>
                <p className="text-slate-500 text-sm">
                  Clique no botão abaixo para selecionar o arquivo TXT (do Mercado Livre) ou PDF da etiqueta.
                </p>
              </div>
              <Button onClick={handleImportTXT} size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-8">
                <Upload className="mr-2 h-5 w-5" /> Selecionar Arquivo (TXT ou PDF)
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept=".txt,.pdf,application/pdf" 
                className="hidden" 
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-6 py-2 bg-white dark:bg-slate-900 border-b shrink-0 flex items-center justify-between">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="flex items-center justify-between gap-4">
                    <TabsList className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border">
                      {blocks.map((block) => (
                        <TabsTrigger 
                          key={block.id} 
                          value={block.id}
                          className={cn(
                            "data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all px-4 h-8 text-xs font-semibold rounded-md flex items-center gap-2"
                          )}
                        >
                          {block.type === 'label' ? <Package className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                          {block.title}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    
                    <Button onClick={handleImportTXT} variant="outline" size="sm" className="h-8 text-xs">
                      <Upload className="mr-2 h-3.5 w-3.5" /> Novo Arquivo
                    </Button>
                  </div>
                </Tabs>
              </div>

              <div className="flex-1 flex min-h-0">
                <aside className="w-[280px] border-r bg-white dark:bg-slate-900 p-4 flex flex-col gap-6 shrink-0 overflow-y-auto">
                  {currentBlock && (
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Detalhes do Arquivo</h4>
                        <div className="space-y-3">
                          {[
                            { label: 'Tipo', value: currentBlock.type === 'label' ? 'Etiqueta' : 'DANFE' },
                            { label: 'Formato', value: currentBlock.stats?.format || 'ZPL' },
                            { label: 'Dimensões', value: currentBlock.stats?.size || 'Auto' },
                            ...(currentBlock.pdf ? [] : [{ label: 'Comandos', value: currentBlock.stats?.commands || 0 }])
                          ].map(item => (
                            <div key={item.label} className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-500 font-medium">{item.label}</span>
                              <span className="text-slate-900 dark:text-slate-300 font-bold">{item.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-4 border-t">
                        <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-3">Configurações</h4>
                        <div className="space-y-4">
                          <PrinterSelector 
                            value={selectedPrinterId}
                            onValueChange={setSelectedPrinterId}
                          />
                        </div>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800/50 flex gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 leading-tight">
                          Esta é uma ferramenta operacional. Certifique-se de que a impressora térmica está pronta antes de imprimir.
                        </p>
                      </div>
                    </div>
                  )}
                </aside>

                <main className="flex-1 bg-slate-50 dark:bg-slate-950 p-6 overflow-hidden flex flex-col">
                  {currentBlock && (
                    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border overflow-hidden">
                      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pré-visualização da Etiqueta</span>
                      </div>
                      <div className="flex-1 p-6 flex items-center justify-center overflow-auto">
                        {currentBlock.pdf ? (
                          <iframe
                            src={currentBlock.pdf}
                            title={`Pré-visualização — ${currentBlock.title}`}
                            className="w-full h-full min-h-[500px] rounded-lg border"
                          />
                        ) : (
                          <LabelPreview 
                            label={{
                              id: currentBlock.id,
                              zpl: currentBlock.zpl,
                              width: detectZPLDimensions(currentBlock.zpl || "").width,
                              height: detectZPLDimensions(currentBlock.zpl || "").height,
                            }}
                            className="max-h-full"
                          />
                        )}
                      </div>
                    </div>
                  )}
                </main>
              </div>
            </div>
          )}
        </div>

        {blocks.length > 0 && (
          <div className="px-6 py-4 bg-white dark:bg-slate-900 border-t flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest">{blocks.length} DOCUMENTO(S) CARREGADO(S)</span>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setBlocks([])}
                className="h-10 px-6 font-bold text-slate-600"
              >
                Limpar
              </Button>
              <Button 
                onClick={() => currentBlock && handlePrintBlock(currentBlock)} 
                disabled={isPrinting || !currentBlock}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-8 min-w-[180px]"
              >
                {isPrinting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    IMPRIMINDO...
                  </>
                ) : (
                  <>
                    <Printer className="mr-2 h-4 w-4" />
                    IMPRIMIR ETIQUETA
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".txt,.pdf,application/pdf" 
        className="hidden" 
      />
    </Dialog>
  );
}