import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { persistNotification, fetchUnreadNotifications, markNotificationAsRead } from "./persistence.server";

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
export const readNotification = createServerFn({ method: "POST" })
  .validator((data: any) => z.object({
    data: z.object({
      notificationId: z.string().uuid(),
      companyId: z.string().uuid(),
    })
  }).parse(data))
  .handler(async ({ data }) => {
    return markNotificationAsRead(data.data.notificationId, data.data.companyId);
  });
