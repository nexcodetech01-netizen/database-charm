import Fastify from 'fastify';
import cors from '@fastify/cors';
import { logger } from './config/logger';
import { printerRoutes } from './routes/printer.routes';

const fastify = Fastify({
  logger: false 
});

fastify.addHook('onRequest', async (request, reply) => {
  (request as any).startTime = Date.now();
  
  // Auditoria de Fluxo (Requisito de Auditoria Avançada)
  if (request.url.includes('/print/zpl')) {
    console.log('--- NEXOS PRINT BRIDGE: AUDITORIA DE REQUEST ---');
    console.log(`Method: ${request.method}`);
    console.log(`URL: ${request.url}`);
    console.log(`Content-Type: ${request.headers['content-type']}`);
    console.log('Headers:', JSON.stringify(request.headers, null, 2));
    console.log('------------------------------------------------');
  }
});

fastify.addHook('onResponse', async (request, reply) => {
  const responseTime = Date.now() - (request as any).startTime;
  
  if (request.url.includes('/print/zpl')) {
     console.log(`--- NEXOS PRINT BRIDGE: AUDITORIA DE RESPOSTA ---`);
     console.log(`Status: ${reply.statusCode}`);
     console.log(`Time: ${responseTime}ms`);
     console.log('-------------------------------------------------');
  }

  if (reply.statusCode >= 400) {
    logger.error(`${request.method} ${request.url} - ${reply.statusCode} - ${responseTime}ms`);
  } else {
    logger.info(`${request.method} ${request.url} - ${reply.statusCode} - ${responseTime}ms`);
  }
});

// Capturar erros globais para retornar stack trace (Requirement 11)
fastify.setErrorHandler((error, request, reply) => {
  logger.error('Erro de Handler:', error);
  reply.status(error.statusCode || 500).send({
    error: error.name,
    message: error.message,
    stack: error.stack, // Retornar stack trace completo conforme solicitado
    code: (error as any).code
  });
});

// Capturar 404s para diagnóstico
fastify.setNotFoundHandler((request, reply) => {
  console.warn(`--- NEXOS PRINT BRIDGE: 404 DETECTADO ---`);
  console.warn(`Method: ${request.method}`);
  console.warn(`URL: ${request.url}`);
  console.warn(`Headers: ${JSON.stringify(request.headers)}`);
  console.warn('-----------------------------------------');
  
  reply.status(404).send({
    error: 'Not Found',
    message: `Route ${request.method}:${request.url} not found`,
    debug: {
      url: request.url,
      method: request.method
    }
  });
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
    const port = Number(process.env.PORT) || 48555;
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
