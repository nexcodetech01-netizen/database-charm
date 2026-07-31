/**
 * KnowledgeIndexer — orquestra o upload + indexação chamando o server function.
 * Nenhum acesso direto ao banco: tudo passa pela camada `src/lib/knowledge.functions`.
 */
import {
  uploadKnowledgeDocument,
  reindexKnowledgeDocument,
  deleteKnowledgeDocument,
  setKnowledgeDocumentStatus,
} from "@/lib/knowledge.functions";
import { KnowledgeCache } from "./KnowledgeCache";
import type {
  KnowledgeDocStatus,
  KnowledgeDocument,
  KnowledgeUploadInput,
} from "./types";

export const KnowledgeIndexer = {
  async upload(input: KnowledgeUploadInput): Promise<KnowledgeDocument> {
    const doc = await uploadKnowledgeDocument({ data: input });
    KnowledgeCache.invalidateCompany(doc.companyId);
    return doc;
  },
  async reindex(documentId: string, content: string): Promise<KnowledgeDocument> {
    const doc = await reindexKnowledgeDocument({ data: { id: documentId, content } });
    KnowledgeCache.invalidateCompany(doc.companyId);
    return doc;
  },
  async remove(documentId: string, companyId: string): Promise<void> {
    await deleteKnowledgeDocument({ data: { id: documentId } });
    KnowledgeCache.invalidateCompany(companyId);
  },
  async setStatus(
    documentId: string,
    status: KnowledgeDocStatus,
  ): Promise<KnowledgeDocument> {
    const doc = await setKnowledgeDocumentStatus({ data: { id: documentId, status } });
    KnowledgeCache.invalidateCompany(doc.companyId);
    return doc;
  },
};
