import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { persistNotification, fetchUnreadNotifications, markNotificationAsRead, markNotificationAsReadByContent } from "./persistence.server";

/**
 * CAUSA RAIZ DE VERDADE DO BUG "notificação sempre volta" — encontrada
 * depois de 4 tentativas de correção diferentes (marcar por conteúdo,
 * corrigir .eq(null), fundir função, adicionar useServerFn — nenhuma
 * resolveu, porque nenhuma delas era a causa real).
 *
 * As 3 funções abaixo validavam o payload com
 * `z.object({ data: z.object({...}) }).parse(data)` — esperando uma
 * camada extra de `data` DENTRO do que o `.inputValidator()` já recebe. Mas
 * o TanStack Start já entrega o conteúdo desembrulhado pro validator —
 * quando o cliente chama `fn({ data: X })`, o validator recebe `X`
 * diretamente, não `{ data: X }`. Then `z.object({ data: ... })`
 * procurava por uma chave "data" que não existia dentro de `X`,
 * gerando exatamente o erro visto o dia inteiro: "path: data,
 * message: Required".
 *
 * Confirmado comparando com QUALQUER outra server function do projeto
 * (ex: `testAsaasConnection`, `interpretWithOpenAI`) — nenhuma outra
 * usa esse embrulho duplo, só essas 3, escritas/mexidas hoje. Por isso
 * nenhuma das correções anteriores (useServerFn incluso) resolvia: o
 * problema nunca esteve em COMO a função era chamada, e sim no schema
 * de validação em si, sempre rejeitando o payload por um motivo
 * diferente do que eu tinha diagnosticado até agora.
 */

/**
 * Persiste uma notificação no banco de dados.
 * Chamado pelo EventEngine/Registry para garantir durabilidade.
 */
export const saveNotification = createServerFn({ method: "POST" })
  .inputValidator((data: any) => z.object({
    companyId: z.string().uuid(),
    eventType: z.string(),
    title: z.string(),
    message: z.string(),
    referenceId: z.string().optional().nullable(),
    metadata: z.record(z.any()).optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    return persistNotification(data);
  });

/**
 * Busca notificações não lidas para a sessão atual.
 */
export const getUnreadNotifications = createServerFn({ method: "GET" })
  .inputValidator((data: any) => z.object({
    companyId: z.string().uuid(),
    limit: z.number().optional().default(50),
  }).parse(data))
  .handler(async ({ data }) => {
    return fetchUnreadNotifications(data.companyId, data.limit);
  });

/**
 * Marca uma notificação como lida — por id (modo antigo) OU por
 * conteúdo (empresa + tipo + referência, pra eventos que chegam ao vivo
 * e têm um id sintético que não bate com o id real do banco).
 */
export const readNotification = createServerFn({ method: "POST" })
  .inputValidator((data: any) => z.object({
    notificationId: z.string().uuid().optional(),
    companyId: z.string().uuid(),
    eventType: z.string().optional(),
    referenceId: z.string().nullable().optional(),
  }).refine(
    (d) => !!d.notificationId || !!d.eventType,
    { message: "Informe notificationId OU eventType (com referenceId)." }
  ).parse(data))
  .handler(async ({ data }) => {
    if (data.notificationId) {
      return markNotificationAsRead(data.notificationId, data.companyId);
    }
    return markNotificationAsReadByContent(
      data.companyId,
      data.eventType!,
      data.referenceId ?? null,
    );
  });
