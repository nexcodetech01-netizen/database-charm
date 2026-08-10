import { FastifyInstance } from 'fastify';
import { PrinterDiscoveryService } from '../services/printer-discovery.service';
import { logger } from '../config/logger';

export async function printerRoutes(fastify: FastifyInstance) {
  const printerService = new PrinterDiscoveryService();

  fastify.get('/health', async () => {
    return {
      status: 'online',
      version: '1.0.0',
      queue: 0,
      printers: (await printerService.discoverPrinters()).length,
      uptime: process.uptime()
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

  // Endpoints de Impressão Enterprise
  fastify.post('/print/pdf', async (request, reply) => {
    const body = request.body as any;
    if (!body.printer || (!body.data && !body.url)) {
      return reply.status(400).send({ error: 'Parâmetros printer e (data ou url) são obrigatórios' });
    }
    return { status: 'Printing', id: Math.random().toString(36).substr(2, 9) };
  });

  fastify.post('/print/zpl', async (request, reply) => {
    const body = request.body as any;
    if (!body.printer || !body.zpl) {
      return reply.status(400).send({ error: 'Parâmetros printer e zpl são obrigatórios' });
    }
    return { status: 'Printing', id: Math.random().toString(36).substr(2, 9) };
  });

  fastify.post('/print/raw', async (request, reply) => {
    const body = request.body as any;
    if (!body.printer || !body.content) {
      return reply.status(400).send({ error: 'Parâmetros printer e content são obrigatórios' });
    }
    return { status: 'Printing', id: Math.random().toString(36).substr(2, 9) };
  });

  fastify.post('/print/image', async (request, reply) => {
    const body = request.body as any;
    if (!body.printer || !body.data) {
      return reply.status(400).send({ error: 'Parâmetros printer e data são obrigatórios' });
    }
    return { status: 'Printing', id: Math.random().toString(36).substr(2, 9) };
  });

  fastify.post('/print/receipt', async (request, reply) => {
    const body = request.body as any;
    if (!body.printer || !body.commands) {
      return reply.status(400).send({ error: 'Parâmetros printer e commands são obrigatórios' });
    }
    return { status: 'Printing', id: Math.random().toString(36).substr(2, 9) };
  });

  fastify.get('/jobs', async () => {
    return [];
  });

  fastify.delete('/jobs/:id', async (request, reply) => {
    return { status: 'Cancelled' };
  });
}
