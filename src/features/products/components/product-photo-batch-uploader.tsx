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
  LayoutGrid
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { processProductImages } from "../../lib/image-processing.functions";

interface QueuedImage {
  id: string;
  file: File;
  preview: string;
  processedUrl?: string;
  isProcessing: boolean;
  status: "pending" | "processing" | "success" | "error";
  error?: string;
}

interface Props {
  companyId: string;
  maxPhotos?: number;
}

export function ProductPhotoBatchUploader({ companyId, maxPhotos = 5 }: Props) {
  const [queue, setQueue] = useState<QueuedImage[]>([]);
  const [activeTab, setActiveTab] = useState<"upload" | "preview">("upload");
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
    if (queue.length === 0) return;

    setQueue(prev => prev.map(img => ({ ...img, isProcessing: true, status: "processing" })));
    
    try {
      const result = await processImagesFn({
        data: {
          images: queue.map((img, idx) => ({
            id: img.id,
            url: img.preview,
            isMain: idx === 0
          }))
        }
      });

      if (result.success) {
        setQueue(prev => prev.map(img => {
          const processed = result.processedImages.find(p => p.id === img.id);
          return {
            ...img,
            processedUrl: processed?.processedUrl || img.preview,
            isProcessing: false,
            status: "success"
          };
        }));
        toast.success("IA: Fotos otimizadas com sucesso!");
      }
    } catch (error) {
      setQueue(prev => prev.map(img => ({ ...img, isProcessing: false, status: "error" })));
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
            A 1ª foto terá fundo branco puro. As demais, cenários de estúdio elegantes.
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
            <p className="text-sm font-medium">Capturar fotos em lote</p>
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
                  src={img.processedUrl || img.preview} 
                  alt={`Preview ${index + 1}`}
                  className={cn(
                    "h-full w-full object-cover transition-opacity",
                    img.isProcessing && "opacity-40"
                  )}
                />
                
                {index === 0 && (
                  <Badge className="absolute top-1 left-1 px-1.5 py-0 text-[9px] bg-primary text-primary-foreground">
                    CAPA
                  </Badge>
                )}

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                  <div className="flex gap-1">
                    <Button 
                      size="icon" 
                      variant="destructive" 
                      className="h-7 w-7"
                      onClick={() => removeImage(img.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {img.isProcessing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[1px]">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                    <span className="text-[9px] text-white mt-1 font-medium">IA...</span>
                  </div>
                )}

                {img.status === "success" && (
                  <div className="absolute bottom-1 right-1">
                    <CheckCircle2 className="h-4 w-4 text-green-500 fill-white" />
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
