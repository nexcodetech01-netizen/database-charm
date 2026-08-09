import React, { useState } from 'react';
import { LabelData, LabelaryAudit } from '../types/printing.types';
import { labelaryService } from '../services/labelary.service';
import { Loader2, FileImage, AlertTriangle, Bug } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface LabelPreviewProps {
  label: LabelData;
  className?: string;
}

export const LabelPreview: React.FC<LabelPreviewProps> = ({ label, className = "" }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [auditData, setAuditData] = useState<LabelaryAudit | null>(null);
  
  React.useEffect(() => {
    let currentUrl: string | null = null;
    
    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      setAuditData(null);
      
      try {
        const blob = await labelaryService.convertToPdf(label);
        currentUrl = URL.createObjectURL(blob);
        setPreviewUrl(currentUrl);
      } catch (err) {
        setAuditData(labelaryService.getLastAudit());
        setError("Preview indisponível. Impressão e download continuam disponíveis.");
      } finally {
        setLoading(false);
      }
    };

    loadPreview();

    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [label]);

  return (
    <div className={`relative flex flex-col items-center justify-center border rounded-md bg-slate-100 dark:bg-slate-900/50 min-h-[500px] overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] z-10 gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Renderizando...</span>
        </div>
      )}
      
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
                 <DialogHeader><DialogTitle>Diagnóstico Labelary</DialogTitle></DialogHeader>
                 <pre className="text-[10px] bg-slate-950 text-emerald-400 p-4 rounded overflow-auto h-[300px]">
                   {JSON.stringify(auditData, null, 2)}
                 </pre>
               </DialogContent>
             </Dialog>
          )}
        </div>
      ) : previewUrl ? (
        <div className="w-full h-full flex items-center justify-center p-4">
          <iframe 
            src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0&view=Fit&pagemode=none`}
            title="Preview"
            className="w-full h-[600px] border shadow-lg bg-white transition-all"
            style={{ 
               transform: label.orientation === 'landscape' ? 'rotate(90deg)' : 'none',
               width: label.orientation === 'landscape' ? '70%' : '100%'
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground p-8 text-center">
          <FileImage className="h-12 w-12 opacity-20" />
          <p className="text-xs">Aguardando dados...</p>
        </div>
      )}
      
      <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-500 border z-20">
        {label.width}" x {label.height}" | {label.orientation || 'portrait'}
      </div>
    </div>
  );
};