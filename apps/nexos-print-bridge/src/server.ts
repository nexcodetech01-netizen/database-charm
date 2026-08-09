import Fastify from 'fastify';
import cors from '@fastify/cors';
import { logger } from './config/logger';
import { printerRoutes } from './routes/printer.routes';

const fastify = Fastify({
  logger: false // Desativamos o logger nativo para usar o Winston
});

// Logger Middleware para tempo de resposta e logs de requisição
fastify.addHook('onRequest', async (request) => {
  (request as any).startTime = Date.now();
  logger.info(`Iniciando requisição: ${request.method} ${request.url}`);
});

fastify.addHook('onResponse', async (request, reply) => {
  const responseTime = Date.now() - (request as any).startTime;
  logger.info(`Requisição concluída: ${request.method} ${request.url} - Status: ${reply.statusCode} - Tempo: ${responseTime}ms`);
});

// Configuração de CORS
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://nexos.nexxcode.com.br'
];

fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) {
      cb(null, true);
      return;
    }
    cb(new Error('Não permitido pelo CORS'), false);
  }
});

// Registro de rotas
fastify.register(printerRoutes);

const start = async () => {
  try {
    const port = 48555;
    const host = '127.0.0.1';
    
    await fastify.listen({ port, host });
    logger.info(`NexOS Print Bridge inicializado com sucesso em http://${host}:${port}`);
  } catch (err) {
    logger.error('Erro ao inicializar o servidor:', err);
    process.exit(1);
  }
};

start();
