/**
 * KnowledgePermissions — camada declarativa de permissões.
 *
 * As garantias reais vêm da RLS do Postgres (ver migração). Este módulo
 * expõe apenas checagens de conveniência para a UI e documenta o contrato:
 *
 *   • Cada empresa acessa somente seus próprios documentos.
 *   • Escrita exige que o usuário esteja autenticado (auth-middleware).
 *   • Nenhum documento é enviado inteiro ao modelo — apenas chunks retornados
 *     pela busca semântica escopada por empresa.
 */

import type { KnowledgeDocStatus } from "./types";

export type KnowledgeAction = "view" | "upload" | "reindex" | "delete" | "toggleStatus";

export interface KnowledgePermissionInput {
  canManage: boolean; // permission "bella_ia.manage" ou "settings.view"
  docStatus?: KnowledgeDocStatus;
}

export function canPerform(action: KnowledgeAction, input: KnowledgePermissionInput): boolean {
  if (action === "view") return true;
  return input.canManage;
}

export const KNOWLEDGE_RLS_NOTE =
  "RLS: knowledge_documents / knowledge_chunks / knowledge_query_logs são filtrados por current_company_id do perfil autenticado.";
