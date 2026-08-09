# NexOS Print Bridge

Serviço local para Windows que faz a ponte entre o NexOS ERP e as impressoras instaladas no sistema operacional.

## Stack
- Node.js
- TypeScript
- Fastify
- Winston (logs)

## Como rodar (Desenvolvimento)
```bash
npm install
npm run dev
```

## API
- `GET /health`: Verifica o status do serviço.
- `GET /printers`: Lista as impressoras instaladas (Mock).

## Porta
O serviço roda por padrão na porta `48555`.
