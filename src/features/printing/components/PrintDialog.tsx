import React from 'react';
import { LabelData, PrintStrategy } from '../types/printing.types';
import { usePrint } from '../hooks/usePrint';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LabelPreview } from './LabelPreview';
import { PrinterSelector } from './PrinterSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Printer, FileJson, FileDown, Loader2 } from 'lucide-react';

interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: LabelData;
}

export const PrintDialog: React.FC<PrintDialogProps> = ({ open, onOpenChange, label }) => {
  const [printerId, setPrinterId] = React.useState<string>('browser');
  const { isPrinting, print, downloadZpl, downloadPdf } = usePrint();

  const handlePrint = async () => {
    const strategy: PrintStrategy = printerId === 'browser' ? 'BROWSER' : 'PDF';
    const result = await print(label, { strategy, printerId });
    if (result.success) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Printing Center
          </DialogTitle>
          <DialogDescription>
            Visualize e selecione o método de impressão para a etiqueta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-4">
            <LabelPreview label={label} />
          </div>

          <div className="space-y-6">
            <PrinterSelector value={printerId} onValueChange={setPrinterId} />

            <div className="space-y-3">
              <label className="text-sm font-medium">Outras Opções</label>
              <div className="grid grid-cols-1 gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start" 
                  onClick={() => downloadPdf(label)}
                  disabled={isPrinting}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Baixar PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="justify-start" 
                  onClick={() => downloadZpl(label)}
                  disabled={isPrinting}
                >
                  <FileJson className="mr-2 h-4 w-4" />
                  Baixar código ZPL
                </Button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handlePrint} disabled={isPrinting}>
            {isPrinting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Etiqueta
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
