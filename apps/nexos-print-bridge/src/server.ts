import Fastify from 'fastify';
import cors from '@fastify/cors';
import { logger } from './config/logger';
import { printerRoutes } from './routes/printer.routes';

const fastify = Fastify({
  logger: false 
});

fastify.addHook('onRequest', async (request) => {
  (request as any).startTime = Date.now();
});

fastify.addHook('onResponse', async (request, reply) => {
  const responseTime = Date.now() - (request as any).startTime;
  if (reply.statusCode >= 400) {
    logger.error(`${request.method} ${request.url} - ${reply.statusCode} - ${responseTime}ms`);
  } else {
    logger.info(`${request.method} ${request.url} - ${reply.statusCode} - ${responseTime}ms`);
  }
});

// Segurança: Aceitar apenas requisições de localhost (Requirement 9)
fastify.register(cors, {
  origin: (origin, cb) => {
    // Em desenvolvimento Electron, origin pode ser nulo ou localhost
    if (!origin || origin.includes('127.0.0.1') || origin.includes('localhost')) {
      cb(null, true);
      return;
    }
    cb(new Error("Not allowed by CORS"), false);
  }
});

fastify.register(printerRoutes);

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 48557;
    const host = '127.0.0.1';
    
    await fastify.listen({ port, host });
    logger.info(`NexOS Print Bridge v1.3.0 em http://${host}:${port}`);
    
    // Log detalhado das rotas em inicialização (Requisito de Auditoria)
    console.log('--- NEXOS PRINT BRIDGE: ROTAS REGISTRADAS ---');
    console.log(fastify.printRoutes());
    console.log('---------------------------------------------');
  } catch (err) {
    logger.error('Erro fatal:', err);
    process.exit(1);
  }
};

start();
