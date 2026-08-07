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
    
    try {
      job.status = 'PROCESSING';
      job.startedAt = new Date();
      job.history.push({ timestamp: new Date(), status: 'PROCESSING' });
      this.emit({ type: 'PRINT_STARTED', jobId: job.id, timestamp: new Date() });

      // Aqui entra a chamada real do serviço de impressão
      // Por enquanto simulamos sucesso se não for RAW (que sabemos que não está implementado)
      if (job.strategy === 'RAW') {
         throw new Error('Estratégia RAW ainda não implementada');
      }

      // Simulação de delay de hardware
      await new Promise(resolve => setTimeout(resolve, 800));

      job.status = 'COMPLETED';
      job.finishedAt = new Date();
      job.history.push({ timestamp: new Date(), status: 'COMPLETED' });
      this.history.push(job);
      this.emit({ type: 'PRINT_FINISHED', jobId: job.id, timestamp: new Date() });
    } catch (error) {
      job.attempts++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      job.error = errorMessage;
      job.history.push({ timestamp: new Date(), status: 'FAILED', message: errorMessage });
      
      if (job.attempts < job.maxAttempts) {
        job.status = 'PENDING';
        this.queue.push(job); // Retry
      } else {
        job.status = 'FAILED';
        this.history.push(job);
        this.emit({ type: 'PRINT_ERROR', jobId: job.id, error: errorMessage, timestamp: new Date() });
      }
    } finally {
      this.isProcessing = false;
      // Pequeno delay para evitar recursão síncrona infinita e permitir que testes vejam a fila
      setTimeout(() => this.process(), 10);
    }
  }

  getQueue() { 
    console.log('Accessing queue, length:', this.queue.length);
    return [...this.queue]; 
  }
  getHistory() { 
    console.log('Accessing history, length:', this.history.length);
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
    if (!label.zpl && !label.content) {
      return { success: false, message: 'Conteúdo da etiqueta vazio' };
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
    if (!label.zpl) return;
    const blob = new Blob([label.zpl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `etiqueta-${label.id}.zpl`;
    a.click();
    URL.revokeObjectURL(url);
  },

  async downloadPdf(label: LabelData) {
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
