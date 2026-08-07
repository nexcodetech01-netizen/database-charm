import React from 'react';
import { LabelData } from '../types/printing.types';
import { labelaryService } from '../services/labelary.service';
import { Loader2, FileImage } from 'lucide-react';

interface LabelPreviewProps {
  label: LabelData;
  className?: string;
}

export const LabelPreview: React.FC<LabelPreviewProps> = ({ label, className = "" }) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  
  const previewUrl = labelaryService.getPreviewUrl(label);

  return (
    <div className={`relative flex items-center justify-center border rounded-md bg-muted/30 min-h-[300px] overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      
      {error ? (
        <div className="flex flex-col items-center gap-2 text-muted-foreground p-8 text-center">
          <FileImage className="h-12 w-12 opacity-20" />
          <p>Não foi possível carregar o preview da etiqueta.</p>
        </div>
      ) : (
        <img 
          src={previewUrl} 
          alt="Preview da Etiqueta" 
          className={`max-w-full max-h-full object-contain shadow-sm transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      )}
      
      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono text-muted-foreground border shadow-sm">
        {label.width}" x {label.height}" @ {label.dpmm}dpmm
      </div>
    </div>
  );
};
