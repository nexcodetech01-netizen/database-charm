import { describe, expect, it } from "vitest";
import {
  addPending,
  artifactObjectPath,
  artifactPathColumn,
  clearPending,
  computePendingArtifacts,
  expectedArtifacts,
  extractArtifactUrls,
  hasPendingArtifacts,
  mergeArtifactUrls,
  normalizePendingKinds,
  type ArtifactDocLike,
  type ArtifactPersistResult,
  type FiscalArtifactKind,
} from "../artifacts";

const authorized: ArtifactDocLike = {
  id: "doc-1",
  status: "authorized",
  accessKey: "3526" + "0".repeat(40),
  xmlAuthorizedPath: null,
  danfePath: null,
  xmlCancellationPath: null,
  artifactsPending: null,
};

describe("artifacts — expectativa e pendências", () => {
  it("documento em rascunho não espera artefatos", () => {
    expect(expectedArtifacts({ ...authorized, status: "draft" })).toEqual([]);
  });

  it("autorizado espera XML e DANFE", () => {
    expect(expectedArtifacts(authorized)).toEqual(["xml_authorized", "danfe"]);
  });

  it("cancelado espera também o XML de cancelamento", () => {
    expect(expectedArtifacts({ ...authorized, status: "cancelled" })).toContain(
      "xml_cancellation",
    );
  });

  it("pendência = esperado − armazenado", () => {
    expect(
      computePendingArtifacts({ ...authorized, xmlAuthorizedPath: "c/nfe/x.xml" }),
    ).toEqual(["danfe"]);
  });

  it("normaliza lixo vindo do banco", () => {
    expect(normalizePendingKinds(["danfe", "danfe", "foo", 3, null])).toEqual(["danfe"]);
    expect(normalizePendingKinds(null)).toEqual([]);
  });

  it("caminhos e colunas são estáveis por kind", () => {
    expect(artifactObjectPath("xml_authorized", authorized)).toBe(
      `nfe/${authorized.accessKey}.xml`,
    );
    expect(artifactObjectPath("danfe", authorized)).toBe(`nfe/${authorized.accessKey}.pdf`);
    expect(artifactObjectPath("xml_cancellation", authorized)).toBe("doc-1/cancelamento.xml");
    expect(artifactPathColumn("danfe")).toBe("danfe_path");
  });
});

describe("artifacts — extração de URLs do provedor", () => {
  it("lê o formato cru da Focus NFe", () => {
    expect(
      extractArtifactUrls({
        raw: {
          caminho_xml_nota_fiscal: "/arquivos/n.xml",
          caminho_danfe: "/arquivos/n.pdf",
          caminho_xml_cancelamento: "/arquivos/c.xml",
        },
      }),
    ).toEqual({
      xml_authorized: "/arquivos/n.xml",
      danfe: "/arquivos/n.pdf",
      xml_cancellation: "/arquivos/c.xml",
    });
  });

  it("lê o formato normalizado do NexOS e ignora vazios", () => {
    expect(extractArtifactUrls({ xmlUrl: "https://a/x.xml", danfeUrl: "  " })).toEqual({
      xml_authorized: "https://a/x.xml",
    });
  });

  it("merge prioriza a primeira fonte", () => {
    expect(
      mergeArtifactUrls({ danfe: "a.pdf" }, { danfe: "b.pdf", xml_authorized: "b.xml" }),
    ).toEqual({ danfe: "a.pdf", xml_authorized: "b.xml" });
  });
});

/**
 * Simulador do fluxo de persistência: reproduz o contrato usado pelo motor
 * (`ArtifactPersistResult`) sem tocar em Supabase, validando falha de
 * download, falha de upload, recuperação e idempotência.
 */
function runPersist(
  doc: ArtifactDocLike,
  persist: (kind: FiscalArtifactKind) => ArtifactPersistResult,
): ArtifactDocLike {
  const targets = computePendingArtifacts(doc);
  let next = { ...doc };
  let pending = normalizePendingKinds(doc.artifactsPending);
  for (const kind of targets) {
    const res = persist(kind);
    if (res.ok) {
      next = { ...next, [camel(kind)]: res.path } as ArtifactDocLike;
      pending = clearPending(pending, [kind]);
    } else {
      pending = addPending(pending, kind);
    }
  }
  return { ...next, artifactsPending: pending };
}

function camel(kind: FiscalArtifactKind) {
  return kind === "xml_authorized"
    ? "xmlAuthorizedPath"
    : kind === "danfe"
      ? "danfePath"
      : "xmlCancellationPath";
}

describe("artifacts — recuperação e idempotência", () => {
  it("falha de download mantém o artefato pendente", () => {
    const out = runPersist(authorized, (kind) =>
      kind === "danfe"
        ? { ok: false, stage: "download", message: "HTTP 502 ao baixar DANFE" }
        : { ok: true, path: "c/nfe/x.xml" },
    );
    expect(out.artifactsPending).toEqual(["danfe"]);
    expect(hasPendingArtifacts(out)).toBe(true);
    expect(out.xmlAuthorizedPath).toBe("c/nfe/x.xml");
  });

  it("falha de upload mantém pendência de ambos", () => {
    const out = runPersist(authorized, () => ({
      ok: false,
      stage: "upload",
      message: "storage indisponível",
    }));
    expect(out.artifactsPending).toEqual(["xml_authorized", "danfe"]);
  });

  it("reprocessamento recupera e limpa a pendência", () => {
    const failed = runPersist(authorized, () => ({
      ok: false,
      stage: "download",
      message: "timeout",
    }));
    const recovered = runPersist(failed, (kind) => ({ ok: true, path: `c/${kind}` }));
    expect(recovered.artifactsPending).toEqual([]);
    expect(recovered.danfePath).toBe("c/danfe");
    expect(hasPendingArtifacts(recovered)).toBe(false);
  });

  it("é idempotente: rodar de novo não baixa nada nem altera o estado", () => {
    const ok = runPersist(authorized, (kind) => ({ ok: true, path: `c/${kind}` }));
    let calls = 0;
    const again = runPersist(ok, (kind) => {
      calls += 1;
      return { ok: true, path: `outro/${kind}` };
    });
    expect(calls).toBe(0);
    expect(again).toEqual(ok);
    expect(computePendingArtifacts(again)).toEqual([]);
  });

  it("não reprocessa artefatos de documento que nunca chegou à SEFAZ", () => {
    const err: ArtifactDocLike = { ...authorized, status: "error" };
    expect(computePendingArtifacts(err)).toEqual([]);
  });
});
