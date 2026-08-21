/**
 * Fiscal v2 — Facade (Sprint 007).
 *
 * Interface única consumida por Skills / UI. Cobre leitura (busca,
 * status, histórico) e delega mutations ao motor único (nfe-engine).
 */
import { BaseService } from "@/features/bella-ai/agent/infrastructure/base-service";
import {
  FiscalDocumentsRepository,
  type SearchDocumentsFilter,
} from "../repository/fiscal-documents.repository";
import { FiscalEventsRepository } from "../repository/fiscal-events.repository";
import type { FiscalDocument, FiscalEvent } from "../types";

export class FiscalService extends BaseService {
  private readonly docs = new FiscalDocumentsRepository(this.supabase, this.companyId);
  private readonly events = new FiscalEventsRepository(this.supabase, this.companyId);

  findById(id: string): Promise<FiscalDocument | null> {
    return this.docs.findById(id);
  }

  findByAccessKey(key: string): Promise<FiscalDocument | null> {
    return this.docs.findByAccessKey(key);
  }

  findBySaleId(saleId: string): Promise<FiscalDocument | null> {
    return this.docs.findBySaleId(saleId);
  }

  search(filter: SearchDocumentsFilter): Promise<FiscalDocument[]> {
    return this.docs.search(filter);
  }

  history(documentId: string): Promise<FiscalEvent[]> {
    return this.events.listByDocument(documentId);
  }

  async cancel(documentId: string, reason: string): Promise<FiscalDocument> {
    // Guarda de estado: somente NF-e autorizada pode ser cancelada.
    const current = await this.docs.findById(documentId);
    if (!current) throw new Error("Documento fiscal não encontrado.");
    if (current.status !== "authorized") {
      throw new Error(
        `Somente NF-e autorizada pode ser cancelada (status atual: ${current.status}).`,
      );
    }
    // Sprint 011: cancelamento passa pelo motor único (provider real + timeline).
    const { cancelDocumentEngine } = await import("../functions/nfe-engine.server");

    await cancelDocumentEngine({
      supabase: this.supabase as never,
      companyId: this.companyId,
      userId: this.ctx.userId,
      documentId,
      reason,
    });
    const doc = await this.docs.findById(documentId);
    if (!doc) throw new Error("Documento não encontrado após o cancelamento.");
    return doc;
  }

  /**
   * Emissão a partir de uma venda (`sales.id`). Nesta Sprint o mapping
   * venda → payload NF-e ainda depende de dados fiscais adicionais
   * (endereço fiscal, NCM/CFOP por produto, regime tributário) que
   * serão parametrizados nas próximas sprints. Retorna erro amigável
   * quando os dados mínimos não estão presentes, sem quebrar a Skill.
   */
  async issueFromSale(
    saleId: string,
    environment: "homologation" | "production" = "homologation",
  ): Promise<{
    document: FiscalDocument;
    validationIssues: Array<{ field: string; message: string }>;
  }> {
    // Sprint 011: a Skill usa exatamente o mesmo motor da UI.
    const { issueNfeFromSaleEngine } = await import("../functions/nfe-engine.server");
    const row = await issueNfeFromSaleEngine({
      supabase: this.supabase as never,
      companyId: this.companyId,
      userId: this.ctx.userId,
      saleId,
      environment,
    });
    const doc = await this.docs.findById(row.id as string);
    if (!doc) throw new Error("Documento fiscal não encontrado após a emissão.");
    const issues =
      doc.status === "rejected" && doc.rejectionCode === "VALIDATION"
        ? [{ field: "payload", message: doc.rejectionReason ?? "Falha de validação." }]
        : [];
    return { document: doc, validationIssues: issues };
  }
}
