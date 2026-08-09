import React, { useState } from 'react';
import { LabelData, LabelaryAudit } from '../types/printing.types';
import { labelaryService } from '../services/labelary.service';
import { Loader2, FileImage, AlertTriangle, Bug, Copy, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Database, Zap, RefreshCw, XCircle, Clock } from 'lucide-react';

interface LabelPreviewProps {
  label: LabelData;
  className?: string;
  onPreviewLoaded?: (success: boolean) => void;
}

export const LabelPreview: React.FC<LabelPreviewProps> = ({ label, className = "", onPreviewLoaded }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<LabelaryAudit | null>(null);

  // Viewport isolado por documento: zoom + scroll nunca são reaproveitados
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState<number | null>(null);

  const isDanfe = Boolean(label.height && label.height > 6);
  const aspect = label.width && label.height ? label.height / label.width : 1.414;

  const resetViewport = React.useCallback(() => {
    setZoom(1);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      scrollRef.current.scrollLeft = 0;
    }
  }, []);

  // fit-to-container: 85% da largura útil, sem escala fixa
  const fitToContainer = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const available = el.clientWidth;
    if (!available) return;
    setFitWidth(Math.max(220, Math.round(available * 0.85)));
    setZoom(1);
    el.scrollTop = 0;
    el.scrollLeft = 0;
  }, []);

  // Reset total ANTES de renderizar um novo documento
  React.useLayoutEffect(() => {
    resetViewport();
    setFitWidth(null);
  }, [label, resetViewport]);

  React.useEffect(() => {
    if (!previewUrl) return;
    const id = window.requestAnimationFrame(() => fitToContainer());
    return () => window.cancelAnimationFrame(id);
  }, [previewUrl, fitToContainer]);

  React.useEffect(() => {
    const onResize = () => fitToContainer();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [fitToContainer]);

  // Cache em memória local do componente para reaproveitar se o usuário alternar abas
  const previewRef = React.useRef<Record<string, string>>({});


  React.useEffect(() => {
    const loadPreview = async () => {
      if (!label.zpl && !label.pdf && !label.image) return;

      const cacheKey = label.zpl || label.pdf || label.image || 'empty';
      if (previewRef.current[cacheKey]) {
        console.log(`[LabelPreview] Reusing local preview for ${label.id}`);
        setPreviewUrl(previewRef.current[cacheKey]);
        setAuditData(labelaryService.getLastAudit()); // Opcional: mostrar o audit do hit anterior
        return;
      }

      setLoading(true);
      setError(null);
      setAuditData(null);
      
      try {
        const blob = await labelaryService.convertToPdf(label);
        const url = URL.createObjectURL(blob);
        previewRef.current[cacheKey] = url;
        setPreviewUrl(url);
        const audit = labelaryService.getLastAudit();
        setAuditData(audit);
        if (onPreviewLoaded) onPreviewLoaded(true);
      } catch (err: any) {
        const audit = labelaryService.getLastAudit();
        setAuditData(audit);
        
        if (audit?.status === 429) {
          setError("Limite temporário da Labelary atingido.");
        } else {
          setError("Preview indisponível. Impressão e download continuam disponíveis.");
        }
        if (onPreviewLoaded) onPreviewLoaded(false);
      } finally {
        setLoading(false);
      }
    };

    loadPreview();

    return () => {
      // Nota: Não revogamos aqui imediatamente para permitir reaproveitamento entre trocas de abas no mesmo diálogo
      // A limpeza deve ocorrer quando o diálogo fechar (gerenciado pelo pai) ou no unmount final.
    };
  }, [label]);

  // Limpeza no unmount do componente
  React.useEffect(() => {
    return () => {
      Object.values(previewRef.current).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  return (
    <div className={cn("relative flex flex-col border rounded-md bg-slate-100 dark:bg-slate-900/50 min-h-[500px] overflow-hidden", className)}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] z-10 gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Renderizando...</span>
        </div>
      )}
      
      <div ref={scrollRef} className="flex-1 overflow-auto scrollbar-thin w-full flex flex-col items-center">
        {error ? (
          <div className="flex flex-col items-center gap-4 p-8 text-center max-w-[300px]">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <p className="text-xs font-semibold text-amber-600">{error}</p>
            {auditData && (
              <Dialog>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-2 text-[10px] font-bold bg-slate-800 text-white px-3 py-1.5 rounded-full hover:bg-slate-700">
                    <Bug className="h-3 w-3" /> Ver Auditoria Técnica
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <div className="flex items-center justify-between pr-8">
                      <DialogTitle>Diagnóstico Labelary</DialogTitle>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px]"
                          onClick={() => {
                            navigator.clipboard.writeText(JSON.stringify(auditData, null, 2));
                            toast.success("Copiado para a área de transferência");
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" /> Copiar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px]"
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `audit-labelary-${new Date().getTime()}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success("Arquivo de auditoria exportado");
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" /> Exportar
                        </Button>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-[10px]">
                        <span className="text-muted-foreground block">Duração Total</span>
                        <span className="font-bold">{auditData.durationMs}ms</span>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-[10px]">
                        <span className="text-muted-foreground block">Duração Cache</span>
                        <span className="font-bold">{auditData.cacheDurationMs?.toFixed(2) || 0}ms</span>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-[10px]">
                        <span className="text-muted-foreground block">Cache Hit</span>
                        <span className={cn("font-bold", auditData.cacheHit ? "text-emerald-500" : "text-amber-500")}>
                          {auditData.cacheHit ? "Sim" : "Não"}
                        </span>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-[10px]">
                        <span className="text-muted-foreground block">Retentativas</span>
                        <span className="font-bold">{auditData.retries || 0}</span>
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-[10px]">
                        <span className="text-muted-foreground block">Labelary Chamado</span>
                        <span className={cn("font-bold", !auditData.cacheHit ? "text-blue-500" : "text-slate-500")}>
                          {!auditData.cacheHit && auditData.url.includes('api.labelary.com') ? "Sim" : "Não"}
                        </span>
                      </div>
                    </div>
                    <pre className="text-[10px] bg-slate-950 text-emerald-400 p-4 rounded overflow-auto h-[300px]">
                      {JSON.stringify(auditData, null, 2)}
                    </pre>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        ) : previewUrl ? (
          <div className="w-full flex-1 flex items-start justify-center p-4 min-h-max overflow-visible">
            <iframe 
              src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH&pagemode=none`}
              title="Preview"
              className="w-full border shadow-lg bg-white transition-all overflow-auto"
              style={{ 
                 height: label.height && label.height > 6 ? '1200px' : '850px',
                 transform: label.orientation === 'landscape' ? 'rotate(90deg)' : 'none',
                 width: label.orientation === 'landscape' ? '70%' : '100%',
                 maxWidth: '900px'
              }}
            />
          </div>
        ) : !loading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground p-8 text-center">
            <FileImage className="h-12 w-12 opacity-20" />
            <p className="text-xs">Aguardando dados...</p>
          </div>
        )}
      </div>
      
      <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
        {loading && (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[9px] font-bold">
            <RefreshCw className="h-2.5 w-2.5 mr-1 animate-spin" /> Carregando...
          </Badge>
        )}
        {!loading && auditData?.cacheHit && (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[9px] font-bold">
            <Database className="h-2.5 w-2.5 mr-1" /> Cache
          </Badge>
        )}
        {!loading && !auditData?.cacheHit && auditData?.status === 200 && (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[9px] font-bold">
            <Zap className="h-2.5 w-2.5 mr-1" /> Atualizado
          </Badge>
        )}
        {!loading && auditData?.status === 429 && (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[9px] font-bold">
            <XCircle className="h-2.5 w-2.5 mr-1" /> Limite Excedido
          </Badge>
        )}
        {auditData?.retries && auditData.retries > 0 ? (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20 text-[9px] font-bold">
             Tentativa {auditData.retries}
          </Badge>
        ) : null}
      </div>

      <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-500 border z-20">
        <Clock className="h-3 w-3 mr-1" /> {auditData?.durationMs || 0}ms | {label.width}" x {label.height}"
      </div>
    </div>
  );
};