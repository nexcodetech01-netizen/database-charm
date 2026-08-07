import { FiscalArtifactKind } from "../lib/artifacts";
import { NfeEnvironment } from "./environment";

/**
 * NF-e Status canonico.
 */
export type NfeStatus =
  | "draft"
  | "validating"
  | "signing"
  | "sending"
  | "authorized"
  | "rejected"
  | "cancelling"
  | "cancelled"
  | "error"
  | "discarded";

/**
 * Eventos fiscais suportados.
 */
export type NfeEventType =
  | "draft"
  | "validating"
  | "signing"
  | "sending"
  | "authorized"
  | "rejected"
  | "cancelling"
  | "cancelled"
  | "error"
  | "discarded"
  | "artifacts_reprocessed"
  | "provider_health_check";

export type FiscalDocumentDto = {
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
  cancelledBy: string | null;
  xmlCancellationPath: string | null;
  rejectionCode: string | null;
  rejectionReason: string | null;
  provider: string | null;
  discardedAt: string | null;
  discardedBy: string | null;
  discardReason: string | null;
  artifactsPending: FiscalArtifactKind[];
  artifactsLastError: string | null;
  artifactsCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Alias para compatibilidade com repositorios legados */
export type FiscalDocument = FiscalDocumentDto;

export type FiscalEventDto = {
  id: string;
  documentId: string;
  eventType: string;
  payloadJson: string | null;
  createdAt: string;
};

/** Alias para compatibilidade com repositorios legados */
export type FiscalEvent = {
  id: string;
  companyId: string;
  documentId: string;
  eventType: NfeEventType;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

export type FiscalDashboard = {
  totals: Record<NfeStatus, number>;
  monthAuthorized: number;
  monthValue: number;
  lastDocument: FiscalDocumentDto | null;
};

export type ReprocessArtifactsResult = {
  document: FiscalDocumentDto;
  recovered: FiscalArtifactKind[];
  stillPending: FiscalArtifactKind[];
  noop: boolean;
  message: string;
};

export type FiscalProviderEnvironmentConfig = {
  environment: NfeEnvironment;
  apiUrl: string | null;
  hasApiKey: boolean;
  hasAdminKey: boolean;
  provisionedAt: string | null;
  provisionedEnvironment: NfeEnvironment | null;
  provisionedCertificateId: string | null;
  provisionedNote: string | null;
  lastHealthCheckAt: string | null;
  lastHealthStatus: "ok" | "warning" | "error" | null;
  lastHealthMessage: string | null;
};

export type FiscalProviderConfig = {
  providerId: string;
  environment: NfeEnvironment;
  apiUrl: string | null;
  notes: string | null;
  webhookUrl: string | null;
  hasApiKey: boolean;
  lastHealthCheckAt: string | null;
  lastHealthStatus: "ok" | "warning" | "error" | null;
  lastHealthMessage: string | null;
  updatedAt: string | null;
  provisionedAt: string | null;
  provisionedEnvironment: NfeEnvironment | null;
  provisionedCertificateId: string | null;
  provisionedNote: string | null;
  environments: Record<NfeEnvironment, FiscalProviderEnvironmentConfig>;
};

export type FiscalCertificateSummary = {
  id: string;
  alias: string;
  subjectName: string | null;
  subjectCnpj: string | null;
  issuerName: string | null;
  validFrom: string | null;
  validTo: string | null;
  serialNumber: string | null;
  thumbprint: string | null;
  isActive: boolean;
  createdAt: string;
};

export type TaxRegime = "simples" | "presumido" | "real" | "mei";

export type FiscalSettings = {
  companyId: string;
  taxRegime: TaxRegime;
  crt: number | null;
  cnaePrincipal: string | null;
  emitUf: string;
  nfeSeries: number;
  nfeNextNumber: number;
  defaultEnvironment: NfeEnvironment;
  operationNature: string;
  defaultCfop: string;
  defaultCsosn: string | null;
  defaultOrigem: number;
  emailFiscal: string | null;
  phoneFiscal: string | null;
  cscId: string | null;
  hasCscToken: boolean;
  issueOnlyAfterPayment: boolean;
  homologationMode: boolean;
  stockOnHomologation: boolean;
  updatedAt: string | null;
};

export type FiscalSaleStatus =
  | "ready"
  | "incomplete"
  | "processing"
  | "issued"
  | "error"
  | "rejected"
  | "discarded"
  | "cancelled";

export type FiscalSaleOption = {
  id: string;
  number: string | null;
  saleDate: string | null;
  paidAt: string | null;
  status: string;
  customerName: string | null;
  customerDocument: string | null;
  itemsSummary: string | null;
  itemCount: number;
  totalAmount: number;
  hasActiveNfe: boolean;
  productName: string | null;
  productSku: string | null;
  fiscalStatus: FiscalSaleStatus;
  fiscalIssues: string[];
  canIssue: boolean;
};

export type SimulationSeverity = "error" | "warning";

export interface SimulationIssue {
  id: string;
  field: string;
  severity: SimulationSeverity;
  title: string;
  detail: string;
  hint?: string;
  step?: "empresa" | "certificado" | "provedor" | "regras" | "cliente" | "venda";
}

export interface FiscalSimulationResult {
  ok: boolean;
  saleId: string;
  environment: NfeEnvironment;
  provider: string;
  blockers: SimulationIssue[];
  warnings: SimulationIssue[];
  summary: {
    customerName: string | null;
    customerDocument: string | null;
    customerEmail: string | null;
    customerAddress: string | null;
    itemCount: number;
    totalAmount: number;
    cfop: string | null;
    ncm: string | null;
    csosn: string | null;
    crt: number | null;
    natureza: string | null;
    series: number | null;
    numberPreview: number | null;
    hasCertificate: boolean;
    certificateAlias: string | null;
    certificateValidTo: string | null;
    hasProviderKey: boolean;
    certificateExpiresIn: number | null;
    companyName: string | null;
    companyCnpj: string | null;
    saleNumber: number | null;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
      ncm: string | null;
    }>;
  };
}

export interface FiscalDocumentContext {
  customerName: string | null;
  customerDocument: string | null;
  itemCount: number;
  cfop: string | null;
  natureza: string | null;
  saleNumber: number | null;
}

export type ProviderHealthResult = {
  status: "ok" | "warning" | "error";
  message: string;
  checkedAt: string;
  items: any[];
};

export type ProviderHealthByEnvironment = {
  production: ProviderHealthResult;
  homologation: ProviderHealthResult;
};

export type CompanyFiscalProfile = {
  id: string;
  legalName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  ie: string | null;
  im: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  addressNumber: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
};

/** Payload para emissão no provedor */
export type NfePayload = {
  saleId: string;
  reference: string;
  model: "55" | "65";
  environment: NfeEnvironment;
  issuedAt: string;
  emitter: {
    cnpj: string;
    legalName: string;
    tradeName: string | null;
    ie: string;
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    zip: string;
    phone: string | null;
  };
  customer: {
    id: string;
    name: string;
    document: string;
    email: string | null;
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
    productId: string | null;
    sku: string | null;
    unit: string | null;
    description: string;
    ncm: string | null;
    cfop: string | null;
    cst: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
    taxes?: any;
  }>;
  totals: {
    products: number;
    discount: number;
    freight: number;
    total: number;
  };
  fiscal: {
    operationNature: string;
    cfop: string;
    csosn: string | null;
    crt: number;
    origem: number;
    series: number;
    number: number | null;
  };
  nfce?: {
    cscId: string;
    cscToken: string;
    paymentMethod: string | null;
  };
};

export type ProviderIssueResult = {
  ok: boolean;
  status: NfeStatus;
  providerRef: string;
  accessKey?: string;
  protocol?: string;
  number?: number;
  series?: number;
  xmlUrl?: string;
  danfeUrl?: string;
  xmlAuthorizedPath?: string;
  xmlSignedPath?: string;
  danfePath?: string;
  rejectionCode?: string;
  rejectionReason?: string;
  raw?: any;
};

export type ProviderStatusResult = ProviderIssueResult & {
  cancellationProtocol?: string;
  cancellationXmlUrl?: string;
  cancelledAt?: string;
};

export type ProviderCancelResult = {
  ok: boolean;
  status: NfeStatus;
  protocol?: string;
  cancelledAt?: string;
  cancellationXmlUrl?: string;
  rejectionCode?: string;
  rejectionReason?: string;
  raw?: any;
};
