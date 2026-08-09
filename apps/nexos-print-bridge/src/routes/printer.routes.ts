import { FastifyInstance } from 'fastify';
import { PrinterDiscoveryService } from '../services/printer-discovery.service';
import { logger } from '../config/logger';

export async function printerRoutes(fastify: FastifyInstance) {
  const printerService = new PrinterDiscoveryService();

  fastify.get('/health', async () => {
    return {
      status: 'online',
      service: 'NexOS Print Bridge',
      version: '1.0.0'
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
}
