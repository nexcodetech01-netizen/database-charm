import { logger } from '../config/logger';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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

  /**
   * BUG ENCONTRADO E CORRIGIDO (2026-08-20): esse método era 100%
   * simulado — só esperava 1,5s e "dava certo" sozinho, sem nunca
   * mandar nada de verdade pra impressora. Era um placeholder deixado
   * como "TODO" (comentário original: "Para esta simulação de
   * Hardening, focamos na infraestrutura de controle") e nunca foi
   * completado. É por isso que o NexOS às vezes "confirmava sucesso"
   * mas nada saía fisicamente — a fila e o controle de status sempre
   * foram reais, só a impressão em si nunca aconteceu.
   *
   * Implementação real por tipo:
   * - PDF: usa o `pdf-to-printer` (Windows, imprime silenciosamente
   *   via SumatraPDF empacotado — não precisa abrir nenhum programa
   *   visível na tela).
   * - ZPL/RAW/RECEIPT (texto puro pra impressora térmica): grava um
   *   arquivo temporário e copia direto pro compartilhamento da
   *   impressora no Windows (`copy /b arquivo \\localhost\NOME`) —
   *   técnica padrão pra mandar bytes crus sem passar pelo driver
   *   gráfico do Windows, necessário pra comandos ZPL funcionarem.
   *   IMPORTANTE: a impressora térmica precisa estar COMPARTILHADA no
   *   Windows (Painel de Controle > Impressoras > Propriedades >
   *   Compartilhamento) com o nome batendo com o que aparece no NexOS
   *   — sem isso, esse método de cópia direta não funciona.
   * - IMAGE: mesma técnica de cópia direta do RAW/ZPL (a maioria das
   *   impressoras térmicas aceita imagem já convertida em comandos
   *   binários da própria impressora).
   */
  private async executePrint(job: PrintJob): Promise<void> {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `nexos-print-${job.id}`);

    try {
      if (job.type === 'PDF') {
        await this.printPdf(job, tmpFile);
      } else {
        await this.printRaw(job, tmpFile);
      }
    } finally {
      // Limpa o arquivo temporário, sucesso ou erro — não deixa lixo
      // acumulando na pasta temp do Windows a cada impressão.
      fs.promises.unlink(tmpFile).catch(() => {});
    }
  }

  private async printPdf(job: PrintJob, tmpFile: string): Promise<void> {
    const base64 = job.data?.data;
    if (!base64) {
      throw new Error('PDF sem conteúdo (campo "data" vazio) — nada pra imprimir.');
    }

    const pdfPath = `${tmpFile}.pdf`;
    await fs.promises.writeFile(pdfPath, Buffer.from(base64, 'base64'));

    // BUG ENCONTRADO E CORRIGIDO (2026-08-22, revisão 2): a impressão
    // chegava até aqui certinho, mas falhava no comando final —
    // confirmado pelo log ao vivo: `-print-to LABEL TERMICA -silent
    // ...` — o pacote `pdf-to-printer` monta o comando como um texto
    // único, sem colocar aspas ao redor do nome da impressora. Como
    // "LABEL TERMICA" tem um ESPAÇO no nome, o programa (SumatraPDF)
    // entendia "LABEL" como o nome da impressora e "TERMICA" como
    // outro argumento solto, e falhava sempre. Só não dava esse erro
    // com impressoras de nome de uma palavra só.
    //
    // Correção: em vez de deixar o pacote montar o comando (que tem
    // esse bug), chamamos o executável do SumatraPDF diretamente via
    // `execFile` com os argumentos numa LISTA separada — assim cada
    // argumento (incluindo nomes com espaço) é passado exatamente como
    // está, sem risco de ser cortado no meio.
    const sumatraPath = require.resolve('pdf-to-printer/dist/SumatraPDF-3.4.6-32.exe');
    try {
      await execFileAsync(sumatraPath, ['-print-to', job.printer, '-silent', pdfPath]);
    } catch (err: any) {
      // DIAGNÓSTICO REFORÇADO (2026-08-22, revisão 3): o erro genérico
      // "Command failed: ..." não mostra o motivo real — só que o
      // comando terminou com erro. Isso escondia a causa verdadeira.
      // Agora expomos o stderr/stdout reais do SumatraPDF, que dizem
      // exatamente por que ele recusou imprimir (driver incompatível,
      // impressora não encontrada pelo nome exato, etc.).
      const detail = [err?.stderr, err?.stdout].filter(Boolean).join(' | ') || err?.message || String(err);
      throw new Error(
        `SumatraPDF recusou a impressão em "${job.printer}": ${detail}. ` +
        `Se essa impressora usa um driver genérico "LABEL" (só para comandos ZPL crus), ` +
        `ela pode não aceitar impressão de PDF por esse caminho — nesse caso, o certo é ` +
        `gerar a etiqueta como ZPL/imagem em vez de PDF pra essa impressora específica.`,
      );
    }

    await fs.promises.unlink(pdfPath).catch(() => {});
  }

  private async printRaw(job: PrintJob, tmpFile: string): Promise<void> {
    // ZPL, RAW e RECEIPT chegam como texto (comandos da impressora ou
    // conteúdo já formatado) — pega o primeiro campo preenchido entre
    // os aceitos pelo schema.
    const content: string | undefined = job.data?.zpl || job.data?.content || job.data?.data;
    if (!content) {
      throw new Error(`Job do tipo ${job.type} sem conteúdo — nada pra imprimir.`);
    }

    const rawFile = `${tmpFile}.prn`;
    await fs.promises.writeFile(rawFile, content, 'binary');

    // Copia os bytes crus direto pro compartilhamento da impressora no
    // Windows — não passa pelo driver gráfico, essencial pra comandos
    // ZPL/RAW funcionarem (imprimir via driver normal reformataria ou
    // ignoraria os comandos). A impressora precisa estar compartilhada
    // no Windows com esse mesmo nome.
    const printerShare = `\\\\localhost\\${job.printer}`;
    try {
      await execFileAsync('cmd.exe', ['/c', 'copy', '/b', rawFile, printerShare]);
    } catch (err: any) {
      throw new Error(
        `Falha ao enviar pra impressora "${job.printer}". Confirme que ela está ` +
        `COMPARTILHADA no Windows (Painel de Controle > Dispositivos e Impressoras > ` +
        `clique com botão direito na impressora > Propriedades da Impressora > aba ` +
        `Compartilhamento > marcar "Compartilhar esta impressora", com o nome do ` +
        `compartilhamento igual ao nome que aparece no NexOS). Erro original: ${err.message}`,
      );
    } finally {
      await fs.promises.unlink(rawFile).catch(() => {});
    }
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
