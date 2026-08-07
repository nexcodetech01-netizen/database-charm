import { NfeStatus } from "../functions/fiscal.functions";
import { FiscalArtifactKind } from "../lib/artifacts";
import { NfeEnvironment } from "./environment";

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
  /** Artefatos que falharam ao ser baixados/gravados e aguardam reprocessamento. */
  artifactsPending: FiscalArtifactKind[];
  artifactsLastError: string | null;
  artifactsCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FiscalEventDto = {
  id: string;
  documentId: string;
  eventType: string;
  payloadJson: string | null;
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

/** Configuração de UM ambiente (Produção ou Homologação), 100% independente. */
export type FiscalProviderEnvironmentConfig = {
  environment: NfeEnvironment;
  apiUrl: string | null;
  /** Token da EMPRESA (emissão de NF-e) cadastrado neste ambiente. */
  hasApiKey: boolean;
  /** Token PRINCIPAL/Admin (endpoints `/v2/empresas`) cadastrado neste ambiente. */
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
  /** Empresa já cadastrada no provedor (POST /v2/empresas não roda na emissão). */
  provisionedAt: string | null;
  provisionedEnvironment: NfeEnvironment | null;
  provisionedCertificateId: string | null;
  provisionedNote: string | null;
  /** Credenciais/URLs independentes por ambiente. */
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
  /** Quando true, só vendas pagas ficam elegíveis para emissão de NF-e. */
  issueOnlyAfterPayment: boolean;
  /** Modo de homologação: badges TESTE e filtros automáticos ligados. */
  homologationMode: boolean;
  /** Baixar estoque nas vendas emitidas em homologação (padrão: sim). */
  stockOnHomologation: boolean;
  updatedAt: string | null;
};

/**
 * Status fiscal da venda (independente do status financeiro).
 */
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
  /** Status fiscal exibido no card do assistente. */
  fiscalStatus: FiscalSaleStatus;
  /** Pendências que impedem a emissão (quando `incomplete`). */
  fiscalIssues: string[];
  /** Pode ser selecionada para emissão (inclui reemissão após erro). */
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
  /** Veredito item a item: qual exatamente falhou. */
  items: any[]; // Avoid circular dependency with provider-health if possible
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
