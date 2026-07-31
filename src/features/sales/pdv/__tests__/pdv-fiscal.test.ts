import { describe, expect, it, vi } from "vitest";
import {
  PDV_NFCE_FAILURE_MESSAGE,
  canPrintPdvDanfe,
  classifyPdvFiscalError,
  isPdvNfceEnabled,
  issuePdvNfce,
  type PdvFiscalDocumentLike,
} from "../lib/fiscal";
import { PDV_SESSION_INITIAL, pdvSessionReducer } from "../lib/completion";

const enabled = {
  cscId: "000001",
  hasCscToken: true,
  defaultEnvironment: "production" as const,
};
const disabled = { cscId: null, hasCscToken: false };

const authorized: PdvFiscalDocumentLike = {
  id: "doc-1",
  status: "authorized",
  number: 42,
  accessKey: "3".repeat(44),
  danfePath: "company/doc-1/danfe.pdf",
  xmlAuthorizedPath: "company/doc-1/nfe.xml",
};

describe("PDV — NFC-e (Sprint 2.10)", () => {
  it("empresa sem NFC-e habilitada não emite documento", async () => {
    const issue = vi.fn();
    const outcome = await issuePdvNfce(
      { saleId: "sale-1", settings: disabled },
      { issue },
    );
    expect(outcome).toEqual({ status: "disabled" });
    expect(issue).not.toHaveBeenCalled();
    expect(isPdvNfceEnabled(disabled)).toBe(false);
    expect(isPdvNfceEnabled(enabled)).toBe(true);
  });

  it("emite com sucesso e associa o documento fiscal à venda", async () => {
    const issue = vi.fn().mockResolvedValue(authorized);
    const outcome = await issuePdvNfce(
      { saleId: "sale-1", settings: enabled },
      { issue },
    );
    expect(issue).toHaveBeenCalledWith({
      saleId: "sale-1",
      environment: "production",
      model: "65",
    });
    expect(outcome).toEqual({
      status: "issued",
      document: {
        id: "doc-1",
        status: "authorized",
        number: "42",
        accessKey: "3".repeat(44),
        danfePath: "company/doc-1/danfe.pdf",
        xmlPath: "company/doc-1/nfe.xml",
        pending: false,
      },
    });
    expect(canPrintPdvDanfe(outcome)).toBe(true);
  });

  it("trata falha de autorização (rejeição) sem lançar", async () => {
    const issue = vi.fn().mockResolvedValue({
      id: "doc-2",
      status: "rejected",
      rejectionReason: "Rejeição 745: CST incompatível",
    });
    const outcome = await issuePdvNfce(
      { saleId: "sale-1", settings: enabled },
      { issue },
    );
    expect(outcome).toEqual({
      status: "failed",
      reason: "rejected",
      message: "Rejeição 745: CST incompatível",
    });
    expect(canPrintPdvDanfe(outcome)).toBe(false);
  });

  it("classifica indisponibilidade da SEFAZ", async () => {
    const issue = vi
      .fn()
      .mockRejectedValue(new Error("Timeout ao comunicar com a SEFAZ"));
    const outcome = await issuePdvNfce(
      { saleId: "sale-1", settings: enabled },
      { issue },
    );
    expect(outcome).toMatchObject({ status: "failed", reason: "unavailable" });
    expect(classifyPdvFiscalError(new Error("boom")).reason).toBe("error");
  });

  it("mantém a venda concluída preservada após falha fiscal", () => {
    const created = pdvSessionReducer(PDV_SESSION_INITIAL, {
      type: "SALE_CREATED",
      sale: { id: "sale-1", number: "PDV-1", total: 100 },
    });
    const receivedState = pdvSessionReducer(created, {
      type: "SALE_RECEIVED",
      paymentMethod: "pix",
      receivedAt: "2026-07-31T12:00:00.000Z",
    });
    const failed = pdvSessionReducer(
      pdvSessionReducer(receivedState, { type: "FISCAL_START" }),
      {
        type: "FISCAL_RESULT",
        outcome: { status: "failed", reason: "unavailable", message: "SEFAZ" },
      },
    );

    expect(failed.completed?.id).toBe("sale-1");
    expect(failed.fiscalPending).toBe(false);
    expect(failed.fiscal).toMatchObject({ status: "failed" });
    expect(PDV_NFCE_FAILURE_MESSAGE).toBe(
      "Venda concluída, mas a NFC-e não pôde ser emitida.",
    );
  });

  it("disponibiliza o DANFE somente quando há artefato persistido", async () => {
    const issue = vi
      .fn()
      .mockResolvedValue({ ...authorized, status: "processing", danfePath: null });
    const outcome = await issuePdvNfce(
      { saleId: "sale-1", settings: enabled },
      { issue },
    );
    expect(outcome).toMatchObject({ status: "issued" });
    expect(canPrintPdvDanfe(outcome)).toBe(false);
    if (outcome.status === "issued") expect(outcome.document.pending).toBe(true);
  });

  it("reseta o estado fiscal ao iniciar nova venda", () => {
    const withFiscal = pdvSessionReducer(PDV_SESSION_INITIAL, {
      type: "FISCAL_RESULT",
      outcome: { status: "disabled" },
    });
    expect(pdvSessionReducer(withFiscal, { type: "NEW_SALE" }).fiscal).toBeNull();
  });
});
