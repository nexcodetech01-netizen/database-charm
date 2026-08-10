import { LabelData, PrintJob, PrintOptions, PrintResult, PrintingEvent } from "../types/printing.types";
import { printerService } from "./printer.service";

/**
 * Enterprise Print Queue Manager
 */
class PrintQueue {
  private queue: PrintJob[] = [];
  private history: PrintJob[] = [];
  private isProcessing = false;
  private listeners: ((event: PrintingEvent) => void)[] = [];

  addListener(listener: (event: PrintingEvent) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: PrintingEvent) {
    this.listeners.forEach(l => l(event));
  }

  async enqueue(label: LabelData, options: PrintOptions): Promise<string> {
    const jobId = Math.random().toString(36).substring(7);
    const job: PrintJob = {
      id: jobId,
      label,
      options,
      status: 'PENDING',
      strategy: options.strategy,
      printerId: options.printerId,
      createdAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      history: [{ timestamp: new Date(), status: 'PENDING', message: 'Job criado' }]
    };

    this.queue.push(job);
    this.process();
    return jobId;
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const job = this.queue.shift()!;
    const startTime = Date.now();
    
    try {
      job.status = 'PROCESSING';
      job.startedAt = new Date();
      
      const printers = await printerService.listPrinters();
      
      // Resolução automática de impressora baseada no tipo (Sprint Final Homologação)
      let resolvedPrinterId = job.printerId;
      if (!resolvedPrinterId || resolvedPrinterId === "browser" || resolvedPrinterId === "") {
        const companyId = job.options.companyId || 'default'; 
        const { getPrintPreferences } = await import("../lib/print-preferences");
        const prefs = getPrintPreferences(companyId);
        
        if (job.options.type === 'LABEL' && prefs.labelPrinterId) {
          resolvedPrinterId = prefs.labelPrinterId;
        } else if (job.options.type === 'RECEIPT' && prefs.receiptPrinterId) {
          resolvedPrinterId = prefs.receiptPrinterId;
        }
      }

      const printer = printers.find(p => p.id === resolvedPrinterId || p.name === resolvedPrinterId);
      const printerName = printer?.name || resolvedPrinterId || 'Impressora Desconhecida';
      
      // Fallback: Se a impressora não for encontrada, informar erro real
      if (resolvedPrinterId && resolvedPrinterId !== "browser" && resolvedPrinterId !== "" && !printer) {
        throw new Error(`Impressora "${resolvedPrinterId}" indisponível. Verifique as configurações.`);
      }

      const isZpl = !!job.label.zpl;
      const canDoRaw = printer?.capabilities.supportsZpl || printer?.capabilities.supportsRaw;

      job.history.push({ 
        timestamp: new Date(), 
        status: 'PROCESSING',
        message: `Iniciando impressão na impressora: ${printerName}`,
        details: {
          type: isZpl ? 'ZPL' : 'PDF/Outro',
          printer: printerName,
          mode: (isZpl && canDoRaw) ? 'RAW' : 'STANDARD'
        }
      });
      
      this.emit({ type: 'PRINT_STARTED', jobId: job.id, timestamp: new Date() });

      // Lógica de Impressão Enterprise via Print Bridge Registry
      const { getPrintBridge } = await import("./print-bridge.registry");
      const bridge = await getPrintBridge();
      const bridgeStatus = await bridge.health();

      if (bridgeStatus.status === 'online') {
        job.history.push({ 
          timestamp: new Date(), 
          status: 'PROCESSING',
          message: `Enviando para NexOS Print Bridge...`,
        });

        const result = await bridge.print(job.label, job.options);
        if (!result.success) {
          console.error(`[PrintQueue] Bridge print failed for job ${job.id}:`, result.message);
          throw new Error(result.message);
        }
        
        job.history.push({ 
          timestamp: new Date(), 
          status: 'COMPLETED',
          message: `Print Bridge confirmou recebimento (Job: ${result.jobId})`,
        });
      } else {
        // Bloqueio rigoroso: No ambiente de produção (online bridge), não permitimos falha silenciosa
        // Se o bridge está offline, informamos o erro
        throw new Error(`NexOS Print Bridge está offline. A saída física requer o Bridge ativo.`);
      }

      job.status = 'COMPLETED';
      job.finishedAt = new Date();
      job.durationMs = Date.now() - startTime;
      job.history.push({ 
        timestamp: new Date(), 
        status: 'COMPLETED',
        message: `Impressão finalizada com sucesso em ${job.durationMs}ms`
      });
      
      this.history.push(job);
      this.emit({ type: 'PRINT_FINISHED', jobId: job.id, timestamp: new Date() });
    } catch (error) {
      job.attempts++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      job.error = errorMessage;
      job.history.push({ 
        timestamp: new Date(), 
        status: 'FAILED', 
        message: `Erro na tentativa ${job.attempts}: ${errorMessage}`,
        details: { error: errorMessage, duration: Date.now() - startTime }
      });
      
      if (job.attempts < job.maxAttempts) {
        job.status = 'PENDING';
        this.queue.push(job); // Retry automático
      } else {
        job.status = 'FAILED';
        job.durationMs = Date.now() - startTime;
        this.history.push(job);
        this.emit({ type: 'PRINT_ERROR', jobId: job.id, error: errorMessage, timestamp: new Date() });
      }
    } finally {
      this.isProcessing = false;
      setTimeout(() => this.process(), 50);
    }
  }

  getQueue() { 
    return [...this.queue]; 
  }
  getHistory() { 
    return [...this.history]; 
  }
  
  // Apenas para testes
  __clear() {
    this.queue = [];
    this.history = [];
    this.isProcessing = false;
  }
}

export const printQueue = new PrintQueue();

/**
 * Enterprise Print Manager - Ponto único de entrada
 */
export const printManager = {
  async print(label: LabelData, options: PrintOptions): Promise<PrintResult> {
    if (!label.zpl && !label.content && !label.pdf && !label.image) {
      return { success: false, message: 'Conteúdo do documento vazio' };
    }


    try {
      const jobId = await printQueue.enqueue(label, options);
      return { success: true, jobId };
    } catch (error) {
      return { 
        success: false, 
        message: 'Erro ao enfileirar impressão',
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  },

  async getPrinters() {
    return await printerService.listPrinters();
  },

  getQueue() {
    return printQueue.getQueue();
  },

  getHistory() {
    return printQueue.getHistory();
  },

  subscribe(listener: (event: PrintingEvent) => void) {
    printQueue.addListener(listener);
  }
};

// Mantemos compatibilidade com o serviço antigo (proxy para o manager)
export const printService = {
  async print(label: LabelData, options: PrintOptions): Promise<PrintResult> {
    return printManager.print(label, options);
  },
  
  // Helpers legados podem ser mantidos ou movidos
  downloadZpl(label: LabelData) {
    if (typeof window === 'undefined' || !label.zpl) return;
    const blob = new Blob([label.zpl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etiqueta-${label.id}.zpl`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async downloadPdf(label: LabelData) {
    if (typeof window === 'undefined') return;
    const { labelaryService } = await import("./labelary.service");
    const blob = await labelaryService.convertToPdf(label);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etiqueta-${label.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
};