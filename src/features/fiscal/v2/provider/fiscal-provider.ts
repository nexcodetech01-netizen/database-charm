/**
 * Fiscal v2 — Contrato do provedor fiscal (Sprint 007 / estendido na 011).
 *
 * A regra de negócio da Bella / do NexOS depende APENAS desta interface.
 * Diferentes provedores (Focus NFe, PlugNotas, TecnoSpeed, mock…) podem
 * ser plugados sem alteração de código nos serviços/skills.
 */
import type {
  NfePayload,
  ProviderCancelResult,
  ProviderIssueResult,
  ProviderStatusResult,
} from "../types";

export interface ProviderArtifact {
  bytes: Uint8Array;
  contentType: string;
}

/** Resultado bruto de um probe autenticado contra a API do provedor. */
export interface ProviderHealthProbe {
  /** Endpoint completo chamado (sem credenciais). */
  endpoint: string;
  method: string;
  /** Credencial usada no probe: emissão (empresa) ou administrativa (conta). */
  credential?: "company" | "admin";
  /** Status HTTP retornado. `0` quando a requisição falhou antes da resposta. */
  httpStatus: number;
  durationMs: number;
  /** Mensagem já extraída da resposta do provedor, quando houver. */
  detail?: string;
  /** Erro de transporte (timeout/DNS/TLS) quando não houve resposta HTTP. */
  networkError?: string;
}


export interface CertificateMaterial {
  /** Conteúdo do .pfx em base64 — NUNCA trafega para o cliente. */
  pfxBase64: string;
  password: string;
  cnpj: string;
}

export interface FiscalProvider {
  /** Nome curto para logs/auditoria (ex.: "mock", "focusnfe", "plugnotas"). */
  readonly id: string;

  /** Indica que o provedor precisa do certificado A1 registrado antes de emitir. */
  readonly requiresCertificate?: boolean;

  /**
   * Recebe a NF-e já validada, assina + transmite ao órgão.
   * Retorna estado + artefatos (XML, protocolo, chave).
   */
  issueNfe(payload: NfePayload): Promise<ProviderIssueResult>;

  /**
   * Consulta status atual no provedor / SEFAZ.
   * Não precisa persistir — o Service decide o que fazer com o resultado.
   */
  getStatus(ref: { accessKey?: string; providerRef?: string }): Promise<ProviderStatusResult>;

  /**
   * Cancela a NF-e autorizada dentro do prazo legal (24h padrão).
   */
  cancelNfe(
    ref: { accessKey: string; providerRef?: string },
    reason: string,
  ): Promise<ProviderCancelResult>;

  /**
   * Registra/atualiza o certificado A1 no provedor (quando aplicável).
   * Executado somente no servidor, antes da emissão.
   */
  registerCertificate?(material: CertificateMaterial): Promise<{ ok: boolean; message?: string }>;

  /**
   * Baixa um artefato (XML/DANFE) a partir da URL retornada pelo provedor,
   * para que o motor persista no bucket privado da empresa.
   */
  downloadArtifact?(url: string): Promise<ProviderArtifact | null>;

  /**
   * Probe autenticado de conectividade: usa a MESMA credencial e o mesmo
   * transporte da emissão, chamando um recurso real da API.
   */
  healthCheck?(): Promise<ProviderHealthProbe>;

  /**
   * Probe autenticado da credencial ADMINISTRATIVA (cadastro de empresa /
   * certificado). Separado do `healthCheck` porque usa outro token.
   */
  adminHealthCheck?(): Promise<ProviderHealthProbe>;

  /** `true` quando existe credencial administrativa dedicada configurada. */
  hasDedicatedAdminToken?(): boolean;
}
