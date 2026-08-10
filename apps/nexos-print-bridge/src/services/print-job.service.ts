import { logger } from '../config/logger';

export interface PrintJob {
  id: string;
  type: 'PDF' | 'ZPL' | 'RAW' | 'IMAGE' | 'RECEIPT';
  printer: string;
  document: string;
  status: 'Pending' | 'Printing' | 'Completed' | 'Error' | 'Timeout';
  createdAt: string;
  finishedAt?: string;
  attempts: number;
  maxAttempts: number;
  error?: string;
  metadata: {
    user?: string;
    companyId?: string;
    documentId?: string;
    ip?: string;
    version: string;
    spoolId?: string;
    durationMs?: number;
  };
  data: any;
}

export class PrintJobService {
  private queue: PrintJob[] = [];
  private history: PrintJob[] = [];
  private isProcessing = false;
  private readonly MAX_HISTORY = 500;
  private readonly DEFAULT_TIMEOUT = 30000; // 30s (Requirement 6)

  async enqueue(jobData: Omit<PrintJob, 'id' | 'status' | 'createdAt' | 'attempts' | 'maxAttempts'>): Promise<string> {
    const job: PrintJob = {
      ...jobData,
      id: Math.random().toString(36).substring(2, 11),
      status: 'Pending',
      createdAt: new Date().toISOString(),
      attempts: 0,
      maxAttempts: 3 // Requirement 5
    };

    this.queue.push(job);
    this.processQueue();
    return job.id;
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;

    const job = this.queue[0];
    const startTime = Date.now();
    
    try {
      job.status = 'Printing';
      
      // Simulação de tentativa de impressão com Timeout (Requirement 6)
      await Promise.race([
        this.executePrint(job),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Print Timeout')), this.DEFAULT_TIMEOUT))
      ]);

      job.status = 'Completed';
      job.finishedAt = new Date().toISOString();
      job.metadata.durationMs = Date.now() - startTime;
      
      this.moveToHistory(this.queue.shift()!);
    } catch (error: any) {
      job.attempts++;
      logger.error(`Job ${job.id} failed (attempt ${job.attempts}): ${error.message}`);
      
      if (job.attempts < job.maxAttempts) {
        // Retry logic (Requirement 5)
        job.status = 'Pending';
        // Mover para o fim da fila e esperar 2s
        const retryingJob = this.queue.shift()!;
        setTimeout(() => {
            this.queue.push(retryingJob);
            this.processQueue();
        }, 2000);
      } else {
        job.status = error.message === 'Print Timeout' ? 'Timeout' : 'Error';
        job.error = error.message;
        job.metadata.durationMs = Date.now() - startTime;
        this.moveToHistory(this.queue.shift()!);
      }
    } finally {
      this.isProcessing = false;
      // Processar próximo job se não for um retry pendente
      if (this.queue.length > 0 && this.queue[0].status === 'Pending') {
         process.nextTick(() => this.processQueue());
      }
    }
  }

  private async executePrint(job: PrintJob): Promise<void> {
    // Aqui integraria com bibliotecas nativas como node-printer ou envio direto para socket
    // Para esta simulação de Hardening, focamos na infraestrutura de controle
    return new Promise((resolve) => setTimeout(resolve, 1500));
  }

  private moveToHistory(job: PrintJob) {
    this.history.unshift(job);
    if (this.history.length > this.MAX_HISTORY) {
      this.history.pop();
    }
    // Log de Auditoria (Requirement 7)
    logger.info(`AUDIT: Job=${job.id} Printer=${job.printer} Status=${job.status} User=${job.metadata.user} Time=${job.metadata.durationMs}ms`);
  }

  getMetrics() {
    const now = Date.now();
    const lastMin = this.history.filter(j => 
        new Date(j.finishedAt || '').getTime() > now - 60000
    );

    const completed = this.history.filter(j => j.status === 'Completed');
    const avgTime = completed.length > 0 
        ? completed.reduce((acc, j) => acc + (j.metadata.durationMs || 0), 0) / completed.length 
        : 0;

    return {
      jobsPerMin: lastMin.length,
      avgDurationMs: avgTime,
      failedCount: this.history.filter(j => j.status === 'Error' || j.status === 'Timeout').length,
      queueSize: this.queue.length,
      totalJobs: this.history.length + this.queue.length
    };
  }

  getJobs() {
    return {
      pending: this.queue,
      history: this.history
    };
  }

  cancelJob(id: string): boolean {
    const idx = this.queue.findIndex(j => j.id === id);
    if (idx > -1) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }
}

export const printJobService = new PrintJobService();
