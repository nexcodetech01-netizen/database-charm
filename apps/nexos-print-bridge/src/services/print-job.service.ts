import { logger } from '../config/logger';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { pdf } from 'pdf-to-img';

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
      // Imagem/PDF: 1 tentativa só — repetir já imprimiu etiqueta em dobro.
      maxAttempts: jobData.type === 'IMAGE' || jobData.type === 'PDF' ? 1 : 3
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
      } else if (job.type === 'IMAGE') {
        // Imagem vai pelo driver normal do Windows (igual à página de
        // teste). Copiar os bytes do PNG direto pra impressora não imprime
        // nada em térmica genérica (LABEL TERMICA / POS-9260-L) e ainda
        // exigia a impressora compartilhada.
        await this.printImage(job, tmpFile);
      } else {
        await this.printRaw(job, tmpFile);
      }
    } finally {
      // Limpa o arquivo temporário, sucesso ou erro — não deixa lixo
      // acumulando na pasta temp do Windows a cada impressão.
      fs.promises.unlink(tmpFile).catch(() => {});
    }
  }

  /**
   * PDF (ex.: etiqueta da SuperFrete). A SuperFrete manda a etiqueta e a
   * declaração de conteúdo (DACE) numa folha grande, uma embaixo da outra.
   * Imprimir a folha inteira na térmica saía ENORME e cortado (21/10/2026).
   *
   * Agora: cada página vira imagem, é recortada nos blocos de conteúdo
   * (etiqueta, DACE...) separados pelos espaços em branco/linha tracejada, e
   * cada bloco sai numa etiqueta 10x15 própria, ajustado sem distorcer.
   * PDF que já é 10x15 (um bloco só) sai igual, ocupando a etiqueta.
   */
  private async printPdf(job: PrintJob, tmpFile: string): Promise<void> {
    const raw: string | undefined = job.data?.data || job.data?.pdf;
    if (!raw) {
      throw new Error('PDF sem conteúdo (campo "data" vazio) — nada pra imprimir.');
    }

    let bytes: Buffer;
    if (/^https?:\/\//i.test(raw)) {
      const res = await fetch(raw);
      if (!res.ok) throw new Error(`Não consegui baixar o PDF da etiqueta (HTTP ${res.status}).`);
      bytes = Buffer.from(await res.arrayBuffer());
    } else {
      bytes = Buffer.from(raw.replace(/^data:.*;base64,/, ''), 'base64');
    }
    const pdfPath = path.resolve(`${tmpFile}.pdf`);
    await fs.promises.writeFile(pdfPath, bytes);

    try {
      const document = await pdf(pdfPath, { scale: 3 });
      let printed = 0;
      for await (const pageImg of document) {
        const blocks = await splitContentBlocks(pageImg as Buffer);
        for (const block of blocks) {
          printed++;
          await this.printImageBuffer(job, block, `${tmpFile}-p${printed}`, 'label10x15');
        }
      }
      if (printed === 0) throw new Error('O PDF não tinha nada para imprimir.');
      logger.info(`PDF impresso em ${printed} etiqueta(s) 10x15 em ${job.printer}`);
    } finally {
      fs.promises.unlink(pdfPath).catch(() => {});
    }
  }

  /**
   * Imprime uma imagem (etiqueta já convertida pelo NexOS) pelo driver
   * normal do Windows, com o papel do tamanho da etiqueta (envio 10x15,
   * Full 40x25...), sem margem, ajustando a imagem sem distorcer.
   */
  private async printImage(job: PrintJob, tmpFile: string): Promise<void> {
    const raw: string | undefined = job.data?.data || job.data?.image;
    if (!raw) {
      throw new Error('Job do tipo IMAGE sem conteúdo — nada pra imprimir.');
    }
    const buf = Buffer.from(raw.replace(/^data:.*;base64,/, ''), 'base64');
    await this.printImageBuffer(job, buf, tmpFile, 'fromImage');
  }

  /**
   * paper:
   *  - 'fromImage': papel do tamanho da imagem a 203 dpi (ZPL convertido).
   *  - 'label10x15': papel 10x15 cm e a imagem ajustada dentro (PDF recortado).
   */
  private async printImageBuffer(
    job: PrintJob,
    image: Buffer,
    tmpFile: string,
    paper: 'fromImage' | 'label10x15',
  ): Promise<void> {
    const imgPath = path.resolve(`${tmpFile}.png`);
    const scriptPath = path.resolve(`${tmpFile}-image.ps1`);
    await fs.promises.writeFile(imgPath, image);

    const paperLine =
      paper === 'label10x15'
        ? `$paperW = 394; $paperH = 591`
        : `$paperW = [int][Math]::Round($img.Width / 203.2 * 100); $paperH = [int][Math]::Round($img.Height / 203.2 * 100)`;

    const psScript = `
param(
  [string]$PrinterName,
  [string]$ImagePath
)
try {
  Add-Type -AssemblyName System.Drawing
  $img = [System.Drawing.Image]::FromFile($ImagePath)
  $doc = New-Object System.Drawing.Printing.PrintDocument
  $doc.PrinterSettings.PrinterName = $PrinterName
  if (-not $doc.PrinterSettings.IsValid) { throw "Impressora '$PrinterName' nao encontrada no Windows." }
  $doc.DocumentName = 'Etiqueta NexOS'
  ${paperLine}
  $doc.DefaultPageSettings.PaperSize = New-Object System.Drawing.Printing.PaperSize('Etiqueta NexOS', $paperW, $paperH)
  $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
  $doc.OriginAtMargins = $false
  $doc.add_PrintPage({
    param($s, $e)
    $b = $e.PageBounds
    $ratio = [Math]::Min($b.Width / $img.Width, $b.Height / $img.Height)
    $w = [int]($img.Width * $ratio)
    $h = [int]($img.Height * $ratio)
    $x = [int](($b.Width - $w) / 2)
    $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $e.Graphics.DrawImage($img, $x, 0, $w, $h)
    $e.HasMorePages = $false
  })
  $doc.Print()
  $img.Dispose()
  Write-Output "Etiqueta enviada para $PrinterName"
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
`;
    await fs.promises.writeFile(scriptPath, psScript, 'utf8');

    try {
      const { stdout, stderr } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-PrinterName', job.printer, '-ImagePath', imgPath],
        { timeout: 25000, windowsHide: true },
      );
      if (stdout) logger.info(`PS Output: ${stdout.trim()}`);
      if (stderr) logger.warn(`PS Error: ${stderr.trim()}`);
    } catch (err: any) {
      const detail = (err?.stderr || err?.message || String(err)).toString().trim();
      throw new Error(`Falha ao imprimir a etiqueta em "${job.printer}": ${detail}`);
    } finally {
      fs.promises.unlink(scriptPath).catch(() => {});
      fs.promises.unlink(imgPath).catch(() => {});
    }
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
    
    // Limpeza de Data URI para dados base64 (Requirement 3.1 fallback)
    if (typeof content === 'string' && content.startsWith('data:')) {
      const cleanBase64 = content.replace(/^data:.*;base64,/, '');
      await fs.promises.writeFile(rawFile, Buffer.from(cleanBase64, 'base64'));
    } else {
      await fs.promises.writeFile(rawFile, content, 'binary');
    }

    // Copia os bytes crus direto pro compartilhamento da impressora no
    // Windows — não passa pelo driver gráfico, essencial pra comandos
    // ZPL/RAW funcionarem (imprimir via driver normal reformataria ou
    // ignoraria os comandos). A impressora precisa estar compartilhada
    // no Windows com esse mesmo nome.
    // IMPORTANTE: Aspas duplas ao redor do caminho do arquivo e do 
    // compartilhamento são vitais para caminhos/nomes com espaço.
    const printerShare = `\\\\localhost\\${job.printer}`;
    try {
      await execFileAsync('cmd.exe', ['/c', 'copy', '/b', `"${rawFile}"`, `"${printerShare}"`]);
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

/**
 * Recorta uma página (PNG) nos blocos de conteúdo empilhados: procura faixas
 * de linhas em branco; blocos muito finos (linha tracejada de "corte aqui")
 * são descartados; cada bloco é aparado nas laterais. Página com um bloco só
 * volta inteira (aparada).
 */
export async function splitContentBlocks(png: Buffer): Promise<Buffer[]> {
  const { createCanvas, loadImage } = await import('@napi-rs/canvas');
  const img = await loadImage(png);
  const W = img.width;
  const H = img.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data;

  const dark = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return data[i] + data[i + 1] + data[i + 2] < 600; // não-branco
  };
  const rowInk: number[] = new Array(H).fill(0);
  for (let y = 0; y < H; y++) {
    let n = 0;
    for (let x = 0; x < W; x += 2) if (dark(x, y)) n++;
    rowInk[y] = n;
  }

  // Faixas de conteúdo separadas por >= 1% da altura em branco.
  const gap = Math.max(4, Math.round(H * 0.01));
  const bands: [number, number][] = [];
  let start = -1;
  let blank = 0;
  for (let y = 0; y < H; y++) {
    if (rowInk[y] > 0) {
      if (start < 0) start = y;
      blank = 0;
    } else if (start >= 0) {
      blank++;
      if (blank >= gap) {
        bands.push([start, y - blank]);
        start = -1;
        blank = 0;
      }
    }
  }
  if (start >= 0) bands.push([start, H - 1]);

  // Linha tracejada / ruído: faixas muito baixas saem.
  const minBand = Math.round(H * 0.04);
  let blocks = bands.filter(([a, b]) => b - a >= minBand);
  // Junta faixas vizinhas muito próximas que pertencem ao mesmo bloco? Não:
  // a etiqueta tem moldura, então vem num bloco só.
  if (blocks.length === 0) blocks = [[0, H - 1]];

  const out: Buffer[] = [];
  for (const [y0, y1] of blocks) {
    let x0 = W;
    let x1 = 0;
    for (let y = y0; y <= y1; y += 2) {
      for (let x = 0; x < W; x++) {
        if (dark(x, y)) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
        }
      }
    }
    if (x1 <= x0) continue;
    const pad = Math.round(W * 0.01);
    const cx = Math.max(0, x0 - pad);
    const cy = Math.max(0, y0 - pad);
    const cw = Math.min(W, x1 + pad) - cx;
    const ch = Math.min(H, y1 + pad) - cy;
    const crop = createCanvas(cw, ch);
    const cctx = crop.getContext('2d');
    cctx.fillStyle = '#fff';
    cctx.fillRect(0, 0, cw, ch);
    cctx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch);
    out.push(crop.toBuffer('image/png'));
  }
  return out;
}

