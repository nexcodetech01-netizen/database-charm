import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { persistNotification, fetchUnreadNotifications, markNotificationAsRead, markNotificationAsReadByContent } from "./persistence.server";

/**
 * Persiste uma notificação no banco de dados.
 * Chamado pelo EventEngine/Registry para garantir durabilidade.
 */
export const saveNotification = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    data: z.object({
      companyId: z.string().uuid(),
      eventType: z.string(),
      title: z.string(),
      message: z.string(),
      referenceId: z.string().optional().nullable(),
      metadata: z.record(z.any()).optional(),
    })
  }).parse(data))
  .handler(async ({ data }) => {
    return persistNotification(data.data);
  });

/**
 * Busca notificações não lidas para a sessão atual.
 */
export const getUnreadNotifications = createServerFn({ method: "GET" })
  .validator((data: any) => z.object({
    data: z.object({
      companyId: z.string().uuid(),
      limit: z.number().optional().default(50),
    })
  }).parse(data))
  .handler(async ({ data }) => {
    return fetchUnreadNotifications(data.data.companyId, data.data.limit);
  });

/**
 * Marca uma notificação específica como lida.
 */
/**
 * Marca uma notificação como lida — por id (modo antigo) OU por
 * conteúdo (empresa + tipo + referência, pra eventos que chegam ao vivo
 * e têm um id sintético que não bate com o id real do banco).
 *
 * NOTA DE ENGENHARIA: originalmente essa segunda forma foi implementada
 * como uma server function NOVA e separada (`readNotificationByContent`).
 * Por algum motivo não totalmente esclarecido — possivelmente um
 * problema no registro dela no manifesto de server functions do
 * TanStack Start em builds incrementais — as chamadas pra essa função
 * nova falhavam consistentemente com um erro de validação Zod dizendo
 * que o payload "data" nunca chegava, mesmo com o payload sendo enviado
 * corretamente e o código sendo estruturalmente idêntico a este aqui
 * (que sempre funcionou). Um rebuild completo não resolveu.
 *
 * Pra não depender de descobrir a causa exata desse problema de
 * infraestrutura, a função nova foi eliminada e essa capacidade foi
 * fundida DENTRO desta rota já comprovadamente funcional — evitando
 * precisar registrar qualquer server function nova.
 */
export const readNotification = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    data: z.object({
      notificationId: z.string().uuid().optional(),
      companyId: z.string().uuid(),
      eventType: z.string().optional(),
      referenceId: z.string().nullable().optional(),
    }).refine(
      (d) => !!d.notificationId || !!d.eventType,
      { message: "Informe notificationId OU eventType (com referenceId)." }
    )
  }).parse(data))
  .handler(async ({ data }) => {
    if (data.data.notificationId) {
      return markNotificationAsRead(data.data.notificationId, data.data.companyId);
    }
    return markNotificationAsReadByContent(
      data.data.companyId,
      data.data.eventType!,
      data.data.referenceId ?? null,
    );
  });
