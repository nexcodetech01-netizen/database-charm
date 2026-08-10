import { FastifyInstance } from 'fastify';
import { PrinterDiscoveryService } from '../services/printer-discovery.service';
import { logger } from '../config/logger';
import { z } from 'zod';
import os from 'os';

// Fila de jobs em memória no bridge
let jobQueue: any[] = [];
let jobHistory: any[] = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || jobQueue.length === 0) return;
  isProcessing = true;
  
  const job = jobQueue[0];
  job.status = 'Printing';
  
  try {
    // Simulação de tempo de impressão real
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    job.status = 'Completed';
    job.finishedAt = new Date().toISOString();
    jobHistory.unshift(jobQueue.shift());
    // Limitar histórico a 100 itens
    if (jobHistory.length > 100) jobHistory.pop();
  } catch (error) {
    job.status = 'Error';
    job.error = String(error);
    jobHistory.unshift(jobQueue.shift());
  } finally {
    isProcessing = false;
    process.nextTick(processQueue);
  }
}

export async function printerRoutes(fastify: FastifyInstance) {
  const printerService = new PrinterDiscoveryService();

  fastify.get('/health', async () => {
    const printers = await printerService.discoverPrinters();
    return {
      status: 'online',
      version: '1.3.0',
      uptime: process.uptime(),
      queue: jobQueue.length,
      jobs: jobHistory.length,
      printers: printers.length,
      memory: {
        free: os.freemem(),
        total: os.totalmem()
      },
      cpu: os.loadavg(),
      windowsSpooler: 'Running' // Idealmente checar via service
    };
  });

  fastify.get('/printers', async (request, reply) => {
    try {
      const printers = await printerService.discoverPrinters();
      return printers;
    } catch (error) {
      logger.error('Erro ao descobrir impressoras:', error);
      return reply.status(500).send({ error: 'Erro ao listar impressoras' });
    }
  });

  const printSchema = z.object({
    printer: z.string(),
    data: z.string().optional(),
    url: z.string().url().optional(),
    zpl: z.string().optional(),
    content: z.string().optional(),
    commands: z.array(z.any()).optional(),
    documentName: z.string().optional()
  });

  const handlePrint = async (type: string, request: any, reply: any) => {
    const result = printSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    const job = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      printer: result.data.printer,
      document: result.data.documentName || `Doc ${type}`,
      status: 'Pending',
      createdAt: new Date().toISOString(),
      data: result.data
    };

    jobQueue.push(job);
    processQueue();
    
    return { success: true, jobId: job.id, status: job.status };
  };

  fastify.post('/print/pdf', (req, res) => handlePrint('PDF', req, res));
  fastify.post('/print/zpl', (req, res) => handlePrint('ZPL', req, res));
  fastify.post('/print/raw', (req, res) => handlePrint('RAW', req, res));
  fastify.post('/print/image', (req, res) => handlePrint('IMAGE', req, res));
  fastify.post('/print/receipt', (req, res) => handlePrint('RECEIPT', req, res));

  fastify.get('/jobs', async () => {
    return {
      pending: jobQueue,
      history: jobHistory
    };
  });

  fastify.delete('/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const index = jobQueue.findIndex(j => j.id === id);
    if (index > -1) {
      jobQueue.splice(index, 1);
      return { status: 'Cancelled' };
    }
    return reply.status(404).send({ error: 'Job not found in queue' });
  });

  fastify.post('/jobs/clear-history', async () => {
    jobHistory = [];
    return { success: true };
  });
}
