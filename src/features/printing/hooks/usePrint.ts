import { useState, useCallback } from 'react';
import { LabelData, PrintOptions, PrintResult, Printer } from '../types/printing.types';
import { printService } from '../services/print.service';
import { toast } from 'sonner';

export function usePrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const print = useCallback(async (label: LabelData, options: PrintOptions): Promise<PrintResult> => {
    setIsPrinting(true);
    try {
      const result = await printService.print(label, options);
      if (result.success) {
        toast.success('Impressão enviada com sucesso!');
      } else {
        toast.error(result.message || 'Erro ao imprimir etiqueta');
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro inesperado na impressão';
      toast.error(message);
      return { success: false, error: error as Error, message };
    } finally {
      setIsPrinting(false);
    }
  }, []);

  const downloadZpl = useCallback((label: LabelData) => {
    try {
      printService.downloadZpl(label);
      toast.success('ZPL baixado com sucesso!');
    } catch (error) {
      toast.error('Erro ao baixar ZPL');
    }
  }, []);

  const downloadPdf = useCallback(async (label: LabelData) => {
    setIsPrinting(true);
    try {
      await printService.downloadPdf(label);
      toast.success('PDF baixado com sucesso!');
    } catch (error) {
      toast.error('Erro ao baixar PDF');
    } finally {
      setIsPrinting(false);
    }
  }, []);

  return {
    isPrinting,
    print,
    downloadZpl,
    downloadPdf
  };
}
