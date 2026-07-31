/**
 * Fiscal v2 — Provider mock (Sprint 007).
 *
 * Simula assinatura + transmissão sem depender de certificados nem
 * de acesso à SEFAZ. Usado em dev e testes até que um provedor real
 * seja integrado.
 */
import type { FiscalProvider } from "./fiscal-provider";
import type {
  NfePayload,
  ProviderCancelResult,
  ProviderIssueResult,
  ProviderStatusResult,
} from "../types";

function fakeAccessKey(): string {
  // 44 dígitos, apenas para simular estrutura.
  let key = "";
  for (let i = 0; i < 44; i++) key += Math.floor(Math.random() * 10).toString();
  return key;
}

function fakeProtocol(): string {
  return `MOCK-${Date.now()}-${Math.floor(Math.random() * 100000)
    .toString()
    .padStart(5, "0")}`;
}

export class FiscalProviderMock implements FiscalProvider {
  readonly id = "mock";

  async issueNfe(payload: NfePayload): Promise<ProviderIssueResult> {
    // Rejeições determinísticas úteis nos testes:
    if (!payload.customer.document) {
      return {
        ok: false,
        status: "rejected",
        rejectionReason: "Documento do destinatário ausente.",
      };
    }
    if (payload.items.length === 0) {
      return {
        ok: false,
        status: "rejected",
        rejectionReason: "NF-e sem itens.",
      };
    }
    const accessKey = fakeAccessKey();
    return {
      ok: true,
      status: "authorized",
      accessKey,
      protocol: fakeProtocol(),
      number: Math.floor(Math.random() * 1_000_000) + 1,
      series: 1,
      providerRef: `mock-${accessKey.slice(-8)}`,
      xmlSignedPath: `mock/xml/signed/${accessKey}.xml`,
      xmlAuthorizedPath: `mock/xml/authorized/${accessKey}.xml`,
      danfePath: `mock/danfe/${accessKey}.pdf`,
    };
  }

  async getStatus(): Promise<ProviderStatusResult> {
    return { ok: true, status: "authorized" };
  }

  async cancelNfe(
    _ref: { accessKey: string; providerRef?: string },
    _reason: string,
  ): Promise<ProviderCancelResult> {
    return {
      ok: true,
      status: "cancelled",
      protocol: fakeProtocol(),
      cancelledAt: new Date().toISOString(),
    };
  }
}
