import { z } from "zod";
export const consignmentStatusSchema = z.enum(["ativa", "fechada", "cancelada"]);
export const commissionTypeSchema = z.enum(["percentual", "valor_fixo"]);
export const settlementStatusSchema = z.enum(["pendente", "pago"]);
