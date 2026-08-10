import { FastifyInstance } from 'fastify';
import { PrinterDiscoveryService } from '../services/printer-discovery.service';
import { printJobService } from '../services/print-job.service';
import { logger } from '../config/logger';
import { z } from 'zod';
import os from 'os';

export async function printerRoutes(fastify: FastifyInstance) {
  const printerService = new PrinterDiscoveryService();

  // Versionamento (Requirement 10)
  fastify.get('/version', async () => {
    return {
      bridge: '2.0.0-hardening',
      electron: process.versions.electron || 'N/A',
      node: process.version,
      build: new Date().toISOString(),
      gitCommit: process.env.GIT_COMMIT || 'development'
    };
  });

  // Health Check Expandido (Requirement 3)
  fastify.get('/health', async () => {
    try {
      const printers = await printerService.discoverPrinters();
      return {
        status: 'online',
        uptime: process.uptime(),
        windowsSpooler: 'Running', // Placeholder
        printersCount: printers.length,
        timestamp: new Date().toISOString()
      };
    } catch (e) {
      return { status: 'degraded', error: String(e) };
    }
  });

  // Métricas (Requirement 8)
  fastify.get('/metrics', async () => {
    const metrics = printJobService.getMetrics();
    return {
      ...metrics,
      system: {
        cpuUsage: os.loadavg(),
        freeMem: os.freemem(),
        totalMem: os.totalmem(),
        platform: os.platform()
      }
    };
  });

  fastify.get('/printers', async () => {
    return await printerService.discoverPrinters();
  });

  fastify.get('/jobs', async () => {
    return printJobService.getJobs();
  });

  const printSchema = z.object({
    printer: z.string(),
    data: z.string().optional(),
    zpl: z.string().optional(),
    content: z.string().optional(),
    documentName: z.string().optional(),
    metadata: z.object({
        user: z.string().optional(),
        companyId: z.string().optional(),
        documentId: z.string().optional()
    }).optional()
  });

  const handlePrint = async (type: string, request: any, reply: any) => {
    console.log(`--- NEXOS PRINT BRIDGE: ENTRADA NO HANDLER POST /print/${type.toLowerCase()} ---`);
    console.log('Body:', JSON.stringify(request.body, null, 2));
    
    try {
      const result = printSchema.safeParse(request.body);
      if (!result.success) {
        console.error('Falha na validação Zod:', result.error);
        return reply.status(400).send({ error: result.error });
      }

      const jobId = await printJobService.enqueue({
        type,
        printer: result.data.printer,
        document: result.data.documentName || `Doc ${type}`,
        metadata: {
          ...result.data.metadata,
          version: '2.0.0',
          ip: request.ip
        },
        data: result.data
      });
      
      console.log(`Job criado com sucesso: ${jobId}`);
      return { success: true, jobId };
    } catch (error: any) {
      console.error('Erro no handler de impressão:', error);
      throw error; // Deixar o setErrorHandler global cuidar da resposta detalhada
    }
  };

  // REGISTRO EXPLÍCITO DAS ROTAS DE IMPRESSÃO
  fastify.post('/print/pdf', { schema: { body: { type: 'object' } } }, (req, res) => handlePrint('PDF', req, res));
  fastify.post('/print/zpl', { schema: { body: { type: 'object' } } }, (req, res) => handlePrint('ZPL', req, res));
  fastify.post('/print/raw', { schema: { body: { type: 'object' } } }, (req, res) => handlePrint('RAW', req, res));
  fastify.post('/print/image', { schema: { body: { type: 'object' } } }, (req, res) => handlePrint('IMAGE', req, res));
  fastify.post('/print/receipt', { schema: { body: { type: 'object' } } }, (req, res) => handlePrint('RECEIPT', req, res));
}
