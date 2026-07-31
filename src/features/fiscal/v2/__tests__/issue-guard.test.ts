/**
 * Fiscal v2 — proteção contra dupla emissão de NF-e por venda.
 *
 * Os testes reproduzem o mesmo protocolo do motor real:
 *   1) checagem prévia de documento ativo (idempotência);
 *   2) INSERT do rascunho serializado pelo índice único parcial;
 *   3) recuperação do vencedor quando o banco devolve 23505.
 */
import { describe, expect, it } from "vitest";

import {
  ACTIVE_FISCAL_STATUSES,
  ACTIVE_SALE_INDEX,
  findActiveDocument,
  isActiveFiscalStatus,
  isActiveSaleUniqueViolation,
} from "../lib/issue-guard";

interface Doc {
  id: string;
  sale_id: string;
  status: string;
  number: number | null;
}

/** Banco em memória com o MESMO índice único parcial da migration. */
class FakeFiscalDb {
  docs: Doc[] = [];
  private seq = 0;
  numbersAllocated = 0;

  private activeFor(saleId: string) {
    return this.docs.find((d) => d.sale_id === saleId && isActiveFiscalStatus(d.status)) ?? null;
  }

  /** SELECT ... WHERE status IN (ativos) */
  selectActive(saleId: string): Doc | null {
    return this.activeFor(saleId);
  }

  /** INSERT com enforcement do índice único parcial. */
  insertDraft(saleId: string): { data: Doc | null; error: unknown } {
    if (this.activeFor(saleId)) {
      return {
        data: null,
        error: {
          code: "23505",
          message: `duplicate key value violates unique constraint "${ACTIVE_SALE_INDEX}"`,
          details: `Key (sale_id)=(${saleId}) already exists.`,
        },
      };
    }
    const doc: Doc = { id: `doc-${++this.seq}`, sale_id: saleId, status: "draft", number: null };
    this.docs.push(doc);
    return { data: doc, error: null };
  }

  allocateNumber(doc: Doc) {
    doc.number = ++this.numbersAllocated;
  }
}

/** Réplica fiel do fluxo do motor (passos 0 e 1 de issueNfeFromSaleEngine). */
async function issue(db: FakeFiscalDb, saleId: string): Promise<Doc> {
  const already = db.selectActive(saleId);
  if (already) return already;

  await Promise.resolve(); // janela de concorrência entre check e act

  const { data, error } = db.insertDraft(saleId);
  if (error) {
    if (isActiveSaleUniqueViolation(error)) {
      const winner = db.selectActive(saleId);
      if (winner) return winner;
    }
    throw error;
  }
  const doc = data as Doc;
  db.allocateNumber(doc); // numeração só depois do rascunho vencer
  doc.status = "authorized";
  return doc;
}

describe("Fiscal v2 — emissão única por venda", () => {
  it("define os mesmos status ativos do índice do banco", () => {
    expect([...ACTIVE_FISCAL_STATUSES]).toEqual([
      "draft",
      "validating",
      "signing",
      "sending",
      "authorized",
      "cancelling",
    ]);
    // Cancelamento em andamento mantém a venda ocupada.
    expect(isActiveFiscalStatus("cancelling")).toBe(true);
    for (const s of ["rejected", "error", "cancelled", "discarded"]) {
      expect(isActiveFiscalStatus(s)).toBe(false);
    }
  });

  it("dois cliques simultâneos geram apenas um documento", async () => {
    const db = new FakeFiscalDb();
    const [a, b] = await Promise.all([issue(db, "sale-1"), issue(db, "sale-1")]);

    expect(a.id).toBe(b.id);
    expect(db.docs).toHaveLength(1);
    expect(db.numbersAllocated).toBe(1);
  });

  it("múltiplas requisições concorrentes convergem para o mesmo documento", async () => {
    const db = new FakeFiscalDb();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => issue(db, "sale-2")),
    );

    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(db.docs).toHaveLength(1);
    expect(db.numbersAllocated).toBe(1);
  });

  it("venda já faturada devolve a NF-e existente sem consumir numeração", async () => {
    const db = new FakeFiscalDb();
    const first = await issue(db, "sale-3");
    const numbersAfterFirst = db.numbersAllocated;

    const again = await issue(db, "sale-3");

    expect(again.id).toBe(first.id);
    expect(again.number).toBe(first.number);
    expect(db.numbersAllocated).toBe(numbersAfterFirst);
    expect(db.docs).toHaveLength(1);
  });

  it("após cancelamento uma nova emissão é permitida", async () => {
    const db = new FakeFiscalDb();
    const first = await issue(db, "sale-4");
    first.status = "cancelled";

    const second = await issue(db, "sale-4");

    expect(second.id).not.toBe(first.id);
    expect(db.docs).toHaveLength(2);
    expect(db.docs.filter((d) => isActiveFiscalStatus(d.status))).toHaveLength(1);
  });

  it("após rejeição/erro/descarte a venda volta a aceitar emissão", async () => {
    for (const terminal of ["rejected", "error", "discarded"]) {
      const db = new FakeFiscalDb();
      const first = await issue(db, "sale-x");
      first.status = terminal;
      const second = await issue(db, "sale-x");
      expect(second.id).not.toBe(first.id);
    }
  });

  it("reconhece somente a violação do índice de emissão ativa", () => {
    expect(
      isActiveSaleUniqueViolation({
        code: "23505",
        message: `duplicate key value violates unique constraint "${ACTIVE_SALE_INDEX}"`,
      }),
    ).toBe(true);
    expect(
      isActiveSaleUniqueViolation({
        code: "23505",
        message: 'duplicate key value violates unique constraint "fiscal_documents_company_id_access_key_key"',
      }),
    ).toBe(false);
    expect(isActiveSaleUniqueViolation({ code: "23503" })).toBe(false);
    expect(isActiveSaleUniqueViolation(null)).toBe(false);
  });

  it("findActiveDocument ignora documentos encerrados", () => {
    expect(
      findActiveDocument([{ status: "cancelled" }, { status: "sending" }]),
    ).toEqual({ status: "sending" });
    expect(findActiveDocument([{ status: "rejected" }])).toBeNull();
    expect(findActiveDocument([])).toBeNull();
  });
});
