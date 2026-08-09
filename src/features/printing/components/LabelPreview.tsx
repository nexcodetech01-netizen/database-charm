import React, { useEffect, useState } from 'react';
import { LabelData } from '../types/printing.types';
import { labelaryService } from '../services/labelary.service';
import { Loader2, FileImage, AlertTriangle } from 'lucide-react';

interface LabelPreviewProps {
  label: LabelData;
  className?: string;
}

export const LabelPreview: React.FC<LabelPreviewProps> = ({ label, className = "" }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  useEffect(() => {
    let currentUrl: string | null = null;
    
    const loadPreview = async () => {
      if (!label.zpl) {
        setPreviewUrl(labelaryService.getPreviewUrl(label));
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        const blob = await labelaryService.convertToPdf(label);
        currentUrl = URL.createObjectURL(blob);
        setPreviewUrl(currentUrl);
      } catch (err) {
        console.error("[LabelPreview.LoadError]", err);
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
    <div className={`relative flex items-center justify-center border rounded-md bg-muted/30 min-h-[400px] overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 z-10 gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Renderizando ZPL...</span>
        </div>
      )}
      
      {error ? (
        <div className="flex flex-col items-center gap-3 text-amber-600 p-8 text-center max-w-[280px]">
          <AlertTriangle className="h-10 w-10 opacity-50" />
          <p className="text-xs font-semibold leading-relaxed">{error}</p>
        </div>
      ) : previewUrl ? (
        <iframe 
          src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=0`}
          title="Preview da Etiqueta"
          className={`w-full h-[400px] border-none transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
        />
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground p-8 text-center">
          <FileImage className="h-12 w-12 opacity-20" />
          <p className="text-xs">Aguardando dados da etiqueta...</p>
        </div>
      )}
      
      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono text-muted-foreground border shadow-sm z-20">
        {label.width || 4}" x {label.height || 6}" @ {label.dpmm || 8}dpmm
      </div>
    </div>
  );
};
