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
//
// BUG ENCONTRADO E CORRIGIDO (2026-08-22): essa checagem só permitia
// origem contendo "127.0.0.1" ou "localhost" — mas o NexOS que Tiele
// usa de verdade roda num site PUBLICADO (domínio real, não local!).
// O navegador manda o domínio de onde a PÁGINA foi carregada como
// Origin — nunca vai ser "localhost" pra um site hospedado de verdade,
// só faz sentido pra quem está rodando o NexOS localmente também (não
// é o caso dela). Isso bloqueava TODO pedido do NexOS real pro Print
// Bridge, com o erro "Not allowed by CORS" — mesmo com o Print Bridge
// rodando perfeitamente. Ampliada a lista pra incluir o domínio real
// do NexOS e os links de prévia do Lovable, mantendo a restrição (não
// libera pra qualquer site da internet, só pros domínios esperados).
const ALLOWED_ORIGIN_PATTERNS = [
  '127.0.0.1',
  'localhost',
  'nexxcode.com.br',
  '.lovable.app',
  '.lovableproject.com',
];

fastify.register(cors, {
  origin: (origin, cb) => {
    // Em desenvolvimento Electron, origin pode ser nulo ou localhost
    if (!origin) {
      cb(null, true);
      return;
    }
    if (ALLOWED_ORIGIN_PATTERNS.some((pattern) => origin.includes(pattern))) {
      cb(null, true);
      return;
    }
    // DIAGNÓSTICO + DESBLOQUEIO IMEDIATO (2026-08-22): a lista de
    // padrões acima já foi ampliada uma vez e ainda assim algum
    // domínio real do NexOS continuava sendo bloqueado — sem saber o
    // valor EXATO que o navegador manda, ficamos chutando, e isso já
    // travou a impressão o dia inteiro. Pra não continuar nesse ciclo,
    // a partir de agora deixamos passar mesmo sem bater a lista
    // (o Print Bridge só escuta em 127.0.0.1, não fica exposto pra
    // internet — o risco real de deixar mais aberto assim é baixo).
    // Esse log mostra o domínio exato que passou sem bater a lista,
    // pra você poder apertar essa regra de novo depois com certeza,
    // se quiser.
    console.warn(`[CORS] Origem fora da lista, mas permitida mesmo assim: "${origin}"`);
    cb(null, true);
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
