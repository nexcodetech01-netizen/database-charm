import React, { useState, useCallback } from "react";
import { 
  Camera, 
  Trash2, 
  Sparkles, 
  GripVertical, 
  Loader2, 
  ImageIcon, 
  CheckCircle2,
  RefreshCw,
  LayoutGrid,
  Eye,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { processProductImages } from "../lib/image-processing.functions";

interface QueuedImage {
  id: string;
  file?: File;
  preview: string;
  processedUrl?: string;
  isProcessing: boolean;
  status: "pending" | "processing" | "success" | "error";
  error?: string;
  isExisting?: boolean;
}

interface Props {
  companyId: string;
  productId?: string;
  maxPhotos?: number;
  existingImages?: Array<{ path: string; signedUrl: string }>;
  onUpdate?: (images: Array<{ path: string; isProcessed: boolean }>) => void;
}

export function ProductPhotoBatchUploader({ companyId, productId, maxPhotos = 5, existingImages = [], onUpdate }: Props) {
  const [queue, setQueue] = useState<QueuedImage[]>(() => {
    return existingImages.map(img => ({
      id: img.path,
      preview: img.signedUrl,
      processedUrl: img.signedUrl,
      isProcessing: false,
      status: "success",
      isExisting: true
    }));
  });
  const [activeTab, setActiveTab] = useState<"upload" | "preview">(existingImages.length > 0 ? "preview" : "upload");
  const [comparingIndex, setComparingIndex] = useState<number | null>(null);
  const processImagesFn = useServerFn(processProductImages);

  const onFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (queue.length + selectedFiles.length > maxPhotos) {
      toast.error(`Limite de ${maxPhotos} fotos excedido.`);
      return;
    }

    const newEntries: QueuedImage[] = selectedFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      preview: URL.createObjectURL(file),
      isProcessing: false,
      status: "pending",
      isExisting: false
    }));

    setQueue((prev) => [...prev, ...newEntries]);
    if (activeTab === "upload") setActiveTab("preview");
  };

  const removeImage = (id: string) => {
    setQueue((prev) => {
      const target = prev.find(img => img.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter(img => img.id !== id);
    });
  };

  const startBatchProcessing = async () => {
    const toProcess = queue.filter(img => img.status === "pending" || img.status === "error");
    if (toProcess.length === 0) {
      toast.info("Não há novas fotos para otimizar.");
      return;
    }

    setQueue(prev => prev.map(img => 
      (img.status === "pending" || img.status === "error") 
        ? { ...img, isProcessing: true, status: "processing" }
        : img
    ));
    
    try {
      const result = await processImagesFn({
        data: {
          images: queue.map((img, idx) => ({
            id: img.id,
            url: img.preview,
            isMain: idx === 0 && !img.isExisting // Apenas se a nova foto for colocada em 1º
          }))
        }
      });

      if (result.success) {
        setQueue(prev => prev.map(img => {
          const processed = result.processedImages.find((p: any) => p.id === img.id);
          if (!processed || img.isExisting) return img; // Preserva existentes
          
          return {
            ...img,
            processedUrl: processed.processedUrl || img.preview,
            isProcessing: false,
            status: "success"
          };
        }));
        toast.success("IA: Novas fotos de detalhe otimizadas!");
      }
    } catch (error) {
      setQueue(prev => prev.map(img => 
        img.status === "processing" ? { ...img, isProcessing: false, status: "error" } : img
      ));
      toast.error("Falha no processamento de IA.");
    }
  };

  const moveItem = (fromIndex: number, toIndex: number) => {
    const newQueue = [...queue];
    const [removed] = newQueue.splice(fromIndex, 1);
    newQueue.splice(toIndex, 0, removed);
    setQueue(newQueue);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Otimização por IA (Mercado Livre)
          </h4>
          <p className="text-[11px] text-muted-foreground">
            Novas fotos recém-adicionadas receberão cenários de estúdio (privacidade). Foto 1 preservada se já existir.
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px]">
          {queue.length} / {maxPhotos}
        </Badge>
      </div>

      {queue.length === 0 ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/20 p-10 transition-all hover:bg-muted/40 hover:border-primary/40 group">
          <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Adicionar fotos de detalhe em lote</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tire até {maxPhotos} fotos agora ou selecione da galeria.
            </p>
          </div>
          <input 
            type="file" 
            accept="image/*" 
            multiple 
            className="hidden" 
            onChange={onFilesSelected} 
          />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {queue.map((img, index) => (
              <div 
                key={img.id} 
                className={cn(
                  "group relative aspect-square rounded-lg border overflow-hidden bg-muted transition-all",
                  index === 0 ? "ring-2 ring-primary ring-offset-2" : "border-border"
                )}
              >
                <img 
                  src={comparingIndex === index ? img.preview : (img.processedUrl || img.preview)} 
                  alt={`Preview ${index + 1}`}
                  className={cn(
                    "h-full w-full object-cover transition-all duration-200",
                    img.isProcessing && "opacity-40",
                    comparingIndex === index && "scale-105 brightness-110"
                  )}
                />
                
                {index === 0 && (
                  <Badge className="absolute top-1 left-1 px-1.5 py-0 text-[9px] bg-primary text-primary-foreground shadow-sm">
                    CAPA
                  </Badge>
                )}

                {/* IA Status Badges */}
                {img.status === "success" && !img.isProcessing && (
                  <div className="absolute top-1 right-1 flex flex-col items-end gap-1">
                    {index === 0 ? (
                      <Badge variant="secondary" className="bg-green-500 hover:bg-green-600 text-white border-none text-[8px] px-1.5 h-4 flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="h-2 w-2" />
                        Fundo Removido (ML OK)
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-600 text-white border-none text-[8px] px-1.5 h-4 flex items-center gap-1 shadow-sm">
                        <Sparkles className="h-2 w-2" />
                        Estúdio Minimalista
                      </Badge>
                    )}
                  </div>
                )}

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-[2px]">
                  <div className="flex flex-col gap-2 p-2 w-full max-w-[80%]">
                    {img.processedUrl && img.processedUrl !== img.preview && (
                      <Button 
                        size="sm" 
                        variant="secondary" 
                        className="h-7 text-[10px] gap-1 font-bold bg-white/90 hover:bg-white text-black border-none"
                        onMouseDown={() => setComparingIndex(index)}
                        onMouseUp={() => setComparingIndex(null)}
                        onMouseLeave={() => setComparingIndex(null)}
                        onTouchStart={() => setComparingIndex(index)}
                        onTouchEnd={() => setComparingIndex(null)}
                      >
                        <Eye className="h-3 w-3" />
                        Ver Original
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      className="h-7 text-[10px] gap-1"
                      onClick={() => removeImage(img.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                      Remover
                    </Button>
                  </div>
                </div>

                {img.isProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px]">
                    <div className="relative">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                      <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-yellow-400 animate-pulse" />
                    </div>
                    <span className="text-[10px] text-white mt-2 font-bold tracking-tight uppercase bg-black/40 px-2 py-0.5 rounded-full">
                      IA Otimizando...
                    </span>
                  </div>
                )}
              </div>
            ))}
            
            {queue.length < maxPhotos && (
              <label className="flex cursor-pointer flex-col items-center justify-center aspect-square rounded-lg border border-dashed border-border bg-muted/20 hover:bg-muted/40 transition-colors">
                <Camera className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] mt-1 text-muted-foreground">Adicionar</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                  onChange={onFilesSelected} 
                />
              </label>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              className="flex-1 gap-2" 
              onClick={startBatchProcessing}
              disabled={queue.some(img => img.isProcessing) || queue.length === 0}
            >
              <Sparkles className="h-4 w-4" />
              Otimizar Fotos com IA
            </Button>
            <Button 
              variant="outline" 
              className="gap-2"
              onClick={() => {
                setQueue([]);
                toast.info("Lote descartado.");
              }}
            >
              Descartar Lote
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
        <Info className="h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-[11px] font-medium leading-relaxed">
          ⚠️ <span className="font-bold">Dica:</span> Clique nas imagens acima para conferir o resultado da otimização e ampliar. Exclua e refaça se o resultado não estiver perfeito antes de salvar o produto.
        </p>
      </div>

      <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 flex gap-3">
        <div className="p-2 rounded-md bg-white border border-primary/20 shrink-0">
          <LayoutGrid className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-1">
          <h5 className="text-[11px] font-bold text-primary uppercase tracking-wider">Interface de Preview Profissional</h5>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Reordene arrastando as fotos. A primeira posição é sempre enviada como foto de capa (fundo branco) para o Mercado Livre.
          </p>
        </div>
      </div>
    </div>
  );
}
