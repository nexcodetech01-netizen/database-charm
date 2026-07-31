/**
 * Fiscal v2 — Tipos primitivos (Sprint 007.3).
 *
 * Mapeamento estável entre a camada de aplicação e as tabelas
 * `fiscal_documents` / `fiscal_events` (schema Supabase real).
 *
 * ⚠ Constraint DB:
 *  - fiscal_documents.status ∈ (draft, validating, signing, sending,
 *    authorized, rejected, cancelled, error)
 *  - fiscal_documents.environment ∈ (homologation, production) — mesmo
 *    enum de `fiscal_provider_config.environment` e
 *    `fiscal_settings.default_environment`.
 *  - fiscal_events.event_type: livre (append-only)
 *
 * O enum canônico vive em `./environment` — não redeclarar literais.
 */

import type { NfeEnvironment } from "./environment";

export {
  FISCAL_ENVIRONMENTS,
  FISCAL_ENVIRONMENT_CONSTRAINTS,
  fiscalEnvironmentSchema,
  normalizeFiscalEnvironment,
} from "./environment";
export type { NfeEnvironment } from "./environment";


/** Modelo do documento fiscal: 55 = NF-e, 65 = NFC-e. */
export type NfeModel = "55" | "65";

export type NfeStatus =

  | "draft"
  | "validating"
  | "signing"
  | "sending"
  | "authorized"
  | "rejected"
  /** Cancelamento solicitado — aguardando confirmação oficial da SEFAZ. */
  | "cancelling"
  | "cancelled"
  | "error"
  | "discarded";


export type NfeEventType =
  | "created"
  | "validated"
  | "signed"
  | "sent"
  | "authorized"
  | "rejected"
  | "cancelled"
  | "error"
  | "discarded";

export interface FiscalDocument {
  id: string;
  companyId: string;
  saleId: string | null;
  number: number | null;
  series: number | null;
  accessKey: string | null;
  status: NfeStatus;
  environment: NfeEnvironment;
  totalAmount: number;
  xmlSignedPath: string | null;
  xmlAuthorizedPath: string | null;
  danfePath: string | null;
  protocol: string | null;
  protocolAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancellationProtocol: string | null;
  rejectionCode: string | null;
  rejectionReason: string | null;
  provider: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalEvent {
  id: string;
  companyId: string;
  documentId: string;
  eventType: NfeEventType;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Payload lógico da NF-e (independente do XML).
 * A serialização/assinatura fica a cargo do provider.
 */
export interface NfePayload {
  saleId: string;
  environment?: NfeEnvironment;
  /**
   * Modelo do documento: `55` = NF-e, `65` = NFC-e (Sprint 2.7).
   * Ausente = `55` (compatibilidade com o fluxo original).
   */
  model?: NfeModel;
  /** Dados exclusivos da NFC-e (modelo 65). */
  nfce?: {
    /** Identificador do CSC (idCSC/CSCid) cadastrado na SEFAZ. */
    cscId: string;
    /** Token CSC em claro — lido do cofre fiscal, NUNCA persistido. */
    cscToken: string;
    /** Forma de pagamento da venda (motor de vendas). */
    paymentMethod?: string | null;
  };

  customer: {
    id: string;
    name: string;
    document: string;
    email?: string | null;
    address?: {
      street: string;
      number: string;
      district: string;
      city: string;
      state: string;
      zip: string;
    };
  };
  items: Array<{
    productId: string;
    /** Código comercial (SKU) do produto, quando cadastrado. */
    sku?: string | null;
    /** Unidade comercial cadastrada no produto (UN, CX, KG...). */
    unit?: string | null;
    description: string;
    ncm: string | null;
    cfop: string | null;
    cst: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  totals: {
    products: number;
    discount: number;
    /** Frete do documento (vFrete). */
    freight?: number;
    total: number;
  };

  /** Referência idempotente enviada ao provedor (default: saleId). */
  reference?: string;
  /** Data/hora de emissão ISO-8601 com offset. */
  issuedAt?: string;
  /** Dados do emitente (preenchidos pelo motor a partir de `companies`). */
  emitter?: {
    cnpj: string;
    legalName: string;
    tradeName?: string | null;
    ie: string;
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    zip: string;
    phone?: string | null;
  };
  /** Parâmetros fiscais resolvidos a partir de `fiscal_settings`. */
  fiscal?: {
    operationNature: string;
    cfop: string;
    csosn: string | null;
    crt: number | null;
    origem: number;
    series: number;
    number: number | null;
  };
}

export interface ProviderIssueResult {
  ok: boolean;
  status: NfeStatus;
  accessKey?: string;
  protocol?: string;
  number?: number;
  series?: number;
  xmlSignedPath?: string;
  xmlAuthorizedPath?: string;
  danfePath?: string;
  /** URL/caminho remoto do XML autorizado no provedor (para download). */
  xmlUrl?: string;
  /** URL/caminho remoto do DANFE no provedor (para download). */
  danfeUrl?: string;
  providerRef?: string;
  rejectionCode?: string;
  rejectionReason?: string;
  raw?: unknown;
}

export interface ProviderCancelResult {
  ok: boolean;
  /**
   * `cancelled` SOMENTE com confirmação oficial da SEFAZ (com protocolo do
   * evento). Enquanto o evento está em processamento use `cancelling`.
   */
  status: NfeStatus;
  /** Protocolo do EVENTO de cancelamento homologado. */
  protocol?: string;
  cancelledAt?: string;
  /** URL do XML do evento de cancelamento, quando o provedor a devolve. */
  cancellationXmlUrl?: string;
  rejectionCode?: string;
  rejectionReason?: string;
  raw?: unknown;
}

export interface ProviderStatusResult {
  ok: boolean;
  status: NfeStatus;
  protocol?: string;
  accessKey?: string;
  number?: number;
  series?: number;
  xmlUrl?: string;
  danfeUrl?: string;
  providerRef?: string;
  /** Protocolo do EVENTO de cancelamento homologado pela SEFAZ. */
  cancellationProtocol?: string;
  /** URL do XML do evento de cancelamento, quando disponível. */
  cancellationXmlUrl?: string;
  /** Data/hora do cancelamento informada pelo provedor. */
  cancelledAt?: string;
  rejectionCode?: string;
  rejectionReason?: string;
  raw?: unknown;
}

