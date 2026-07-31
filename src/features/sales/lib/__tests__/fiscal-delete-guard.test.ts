import { describe, expect, it } from "vitest";
import {
  FISCAL_DELETE_BLOCKED_MESSAGE,
  FiscalDeleteBlockedError,
  blocksSaleDeletion,
  findBlockingFiscalDocument,
  isFiscalDeleteBlockedError,
} from "../fiscal-delete-guard";

describe("fiscal-delete-guard (P0.6.2)", () => {
  it("venda sem documento fiscal pode ser excluída", () => {
    expect(findBlockingFiscalDocument([])).toBeNull();
    expect(findBlockingFiscalDocument(null)).toBeNull();
    expect(findBlockingFiscalDocument(undefined)).toBeNull();
  });

  it.each(["authorized", "cancelling", "cancelled", "draft", "sending", "signing", "validating"])(
    "status %s bloqueia a exclusão",
    (status) => {
      expect(blocksSaleDeletion(status)).toBe(true);
      expect(findBlockingFiscalDocument([{ id: "doc-1", status }])?.id).toBe("doc-1");
    },
  );

  it.each(["rejected", "error", "discarded", null, undefined, 42])(
    "status %s não bloqueia",
    (status) => {
      expect(blocksSaleDeletion(status)).toBe(false);
    },
  );

  it("encontra o documento bloqueante entre documentos inertes", () => {
    const doc = findBlockingFiscalDocument([
      { id: "a", status: "rejected" },
      { id: "b", status: "discarded" },
      { id: "c", status: "authorized" },
    ]);
    expect(doc?.id).toBe("c");
  });

  it("erro de bloqueio carrega mensagem e contexto do documento", () => {
    const err = new FiscalDeleteBlockedError("doc-9", "authorized");
    expect(err.message).toBe(FISCAL_DELETE_BLOCKED_MESSAGE);
    expect(err.code).toBe("SALE_HAS_FISCAL_DOCUMENT");
    expect(err.documentId).toBe("doc-9");
    expect(err.documentStatus).toBe("authorized");
    expect(isFiscalDeleteBlockedError(err)).toBe(true);
    expect(isFiscalDeleteBlockedError(new Error("outro"))).toBe(false);
  });
});
