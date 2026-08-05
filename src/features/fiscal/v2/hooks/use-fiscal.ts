/**
 * Sprint 007.2 — Hooks React Query do módulo Fiscal.
 *
 * Encapsula chamadas às server functions (`fiscal.functions.ts`),
 * mantém cache coerente após mutações e escuta `fiscal_documents`
 * em tempo real para refletir autorização/rejeição/cancelamento
 * sem intervenção do usuário.
 */
import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import {
  cancelFiscalDocument,
  deactivateFiscalCertificate,
  exportFiscalXmlsBatch,
  discardFiscalDocument,
  deleteFiscalCertificate,
  getCompanyFiscalProfile,
  getFiscalArtifactUrl,
  getFiscalDashboard,
  getFiscalDocument,
  getFiscalDocumentContext,
  getFiscalProviderConfig,
  getFiscalSettings,
  issueFiscalFromSale,
  listFiscalCertificates,
  listFiscalDocuments,
  refreshFiscalStatus,
  reprocessFiscalArtifacts,
  setCertificatePassword,
  setCscToken,
  setProviderApiKey,
  simulateFiscalIssue,
  testProviderConnection,
  updateFiscalProviderConfig,
  updateFiscalSettings,
  uploadFiscalCertificate,
  type CompanyFiscalProfile,
  type FiscalCertificateSummary,
  type FiscalDashboard,
  type FiscalDocumentContext,
  type FiscalDocumentDto,
  type FiscalEventDto,
  type FiscalProviderConfig,
  type FiscalSettings,
  type FiscalSimulationResult,
  type NfeEnvironment,
  type ProviderHealthResult,
  type ReprocessArtifactsResult,
} from "../functions/fiscal.functions";
import { resolveActiveFiscalDocument } from "../lib/fiscal-status";

export const fiscalKeys = {
  all: ["fiscal"] as const,
  dashboard: () => [...fiscalKeys.all, "dashboard"] as const,
  list: (filters?: FiscalListFilters) =>
    [...fiscalKeys.all, "list", filters ?? {}] as const,
  detail: (documentId: string) =>
    [...fiscalKeys.all, "detail", documentId] as const,
  provider: () => [...fiscalKeys.all, "provider"] as const,
  settings: () => [...fiscalKeys.all, "settings"] as const,
  companyProfile: () => [...fiscalKeys.all, "companyProfile"] as const,
  certificates: () => [...fiscalKeys.all, "certificates"] as const,
};

export interface FiscalListFilters {
  status?: string;
  saleId?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
}

// ----------------------------------------------------------------- queries

export function useFiscalDashboard() {
  const fn = useServerFn(getFiscalDashboard);
  return useQuery<FiscalDashboard>({
    queryKey: fiscalKeys.dashboard(),
    queryFn: () => fn(),
    staleTime: 30_000,
  });
}

export function useFiscalDocuments(filters: FiscalListFilters = {}) {
  const fn = useServerFn(listFiscalDocuments);
  return useQuery<FiscalDocumentDto[]>({
    queryKey: fiscalKeys.list(filters),
    queryFn: () => fn({ data: filters }),
    staleTime: 15_000,
  });
}

export function useFiscalDocument(documentId: string | undefined) {
  const fn = useServerFn(getFiscalDocument);
  return useQuery<{ document: FiscalDocumentDto; events: FiscalEventDto[] }>({
    queryKey: documentId
      ? fiscalKeys.detail(documentId)
      : [...fiscalKeys.all, "detail", "none"],
    queryFn: () => fn({ data: { documentId: documentId! } }),
    enabled: Boolean(documentId),
    staleTime: 10_000,
  });
}

export function useFiscalDocumentContext(documentId: string | undefined) {
  const fn = useServerFn(getFiscalDocumentContext);
  return useQuery<FiscalDocumentContext>({
    queryKey: [...fiscalKeys.all, "detail-context", documentId ?? "none"],
    queryFn: () => fn({ data: { documentId: documentId! } }),
    enabled: Boolean(documentId),
    staleTime: 30_000,
  });
}

/** Chave de cache do documento fiscal vinculado a uma venda. */
export function saleFiscalKey(saleId: string | undefined) {
  return [...fiscalKeys.all, "by-sale", saleId ?? "none"] as const;
}


/**
 * Documento fiscal "vigente" de uma venda (o autorizado tem precedência,
 * depois cancelado, em processamento e por fim rejeitado/erro).
 *
 * Mantém a tela de detalhes da venda sincronizada em tempo real: qualquer
 * mudança em `fiscal_documents` daquela venda invalida este cache e o
 * detalhe da venda, sem que o operador precise recarregar a página.
 */
export function useSaleFiscalDocument(saleId: string | undefined) {
  const fn = useServerFn(listFiscalDocuments);
  const qc = useQueryClient();

  const query = useQuery<FiscalDocumentDto | null>({
    queryKey: saleFiscalKey(saleId),
    queryFn: async () => {
      const all = await fn({ data: { saleId, limit: 20 } });
      // Somente documentos ATIVOS representam a venda; descartes ficam
      // no histórico do módulo fiscal.
      return resolveActiveFiscalDocument(all);
    },
    enabled: Boolean(saleId),
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!saleId) return;
    const channel = supabase
      .channel(`sale-fiscal-${saleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fiscal_documents",
          filter: `sale_id=eq.${saleId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: saleFiscalKey(saleId) });
          qc.invalidateQueries({ queryKey: ["sales", "detail", saleId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [saleId, qc]);

  return query;
}



export function useSimulateFiscal() {
  const fn = useServerFn(simulateFiscalIssue);
  return useMutation<FiscalSimulationResult, Error, { saleId: string; environment?: NfeEnvironment }>({
    mutationFn: (input) => fn({ data: input }),
  });
}

/**
 * Configuração fiscal (settings/provider/certificados/empresa) é fonte única:
 * mesmas opções de cache em TODAS as telas. `refetchOnMount: true` é
 * obrigatório — sem isso, uma query invalidada porém inativa continua
 * servindo o valor antigo ao remontar (ex.: banner de ambiente preso em
 * homologação depois de salvar produção).
 */
const FISCAL_CONFIG_QUERY = {
  staleTime: 30_000,
  gcTime: 30 * 60_000,
  refetchOnMount: true,
  refetchOnWindowFocus: false,
} as const;

/** Invalida todo o cache de configuração fiscal (ambiente incluso). */
export function useInvalidateFiscalConfig() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: fiscalKeys.settings() });
    qc.invalidateQueries({ queryKey: fiscalKeys.provider() });
    qc.invalidateQueries({ queryKey: fiscalKeys.companyProfile() });
    qc.invalidateQueries({ queryKey: fiscalKeys.certificates() });
    qc.invalidateQueries({ queryKey: fiscalKeys.dashboard() });
  };
}

export function useFiscalSettings() {
  const fn = useServerFn(getFiscalSettings);
  return useQuery<FiscalSettings>({
    queryKey: fiscalKeys.settings(),
    queryFn: () => fn(),
    ...FISCAL_CONFIG_QUERY,
  });
}

export function useCompanyFiscalProfile() {
  const fn = useServerFn(getCompanyFiscalProfile);
  return useQuery<CompanyFiscalProfile>({
    queryKey: fiscalKeys.companyProfile(),
    queryFn: () => fn(),
    ...FISCAL_CONFIG_QUERY,
  });
}

export function useFiscalProviderConfig() {
  const fn = useServerFn(getFiscalProviderConfig);
  return useQuery<FiscalProviderConfig>({
    queryKey: fiscalKeys.provider(),
    queryFn: () => fn(),
    ...FISCAL_CONFIG_QUERY,
  });
}

export function useFiscalCertificates() {
  const fn = useServerFn(listFiscalCertificates);
  return useQuery<FiscalCertificateSummary[]>({
    queryKey: fiscalKeys.certificates(),
    queryFn: () => fn(),
    ...FISCAL_CONFIG_QUERY,
  });
}

// --------------------------------------------------------------- mutations

function useInvalidateFiscal() {
  const qc = useQueryClient();
  return (documentId?: string, saleId?: string | null) => {
    qc.invalidateQueries({ queryKey: fiscalKeys.dashboard() });
    qc.invalidateQueries({ queryKey: [...fiscalKeys.all, "list"] });
    qc.invalidateQueries({ queryKey: [...fiscalKeys.all, "by-sale"] });
    if (documentId) qc.invalidateQueries({ queryKey: fiscalKeys.detail(documentId) });
    if (saleId) qc.invalidateQueries({ queryKey: ["sales", "detail", saleId] });
  };
}


export function useIssueFiscal(
  options?: UseMutationOptions<FiscalDocumentDto, Error, { saleId: string; environment?: NfeEnvironment }>,
) {
  const fn = useServerFn(issueFiscalFromSale);
  const invalidate = useInvalidateFiscal();
  const { onSuccess, onError, ...rest } = options ?? {};
  return useMutation({
    mutationFn: (input) => fn({ data: input }),
    onSuccess: (doc, ...args) => {
      invalidate(doc.id, doc.saleId);
      if (doc.status === "authorized") {
        toast.success("NF-e autorizada com sucesso.");
      } else if (doc.status === "rejected" || doc.status === "error") {
        toast.error("Falha na emissão.", {
          description: doc.rejectionReason ?? undefined,
        });
      } else {
        toast.info(`NF-e em processamento (${doc.status}).`);
      }
      (onSuccess as ((d: FiscalDocumentDto, ...a: unknown[]) => void) | undefined)?.(doc, ...args);
    },

    onError: (err, ...args) => {
      toast.error(err.message || "Falha ao emitir NF-e.");
      (onError as ((e: Error, ...a: unknown[]) => void) | undefined)?.(err, ...args);
    },
    ...rest,
  });
}

export function useCancelFiscal(
  options?: UseMutationOptions<FiscalDocumentDto, Error, { documentId: string; reason: string }>,
) {
  const fn = useServerFn(cancelFiscalDocument);
  const invalidate = useInvalidateFiscal();
  const { onSuccess, onError, ...rest } = options ?? {};
  return useMutation({
    mutationFn: (input) => fn({ data: input }),
    onSuccess: (doc, ...args) => {
      invalidate(doc.id, doc.saleId);
      toast.success("NF-e cancelada.");
      (onSuccess as ((d: FiscalDocumentDto, ...a: unknown[]) => void) | undefined)?.(doc, ...args);
    },
    onError: (err, ...args) => {
      toast.error(err.message || "Falha ao cancelar NF-e.");
      (onError as ((e: Error, ...a: unknown[]) => void) | undefined)?.(err, ...args);
    },
    ...rest,
  });
}

export function useRefreshFiscalStatus() {
  const fn = useServerFn(refreshFiscalStatus);
  const invalidate = useInvalidateFiscal();
  return useMutation({
    mutationFn: (documentId: string) => fn({ data: { documentId } }),
    onSuccess: (doc) => {
      invalidate(doc.id, doc.saleId);
      toast.success("Status atualizado.");
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao consultar status."),
  });
}

/**
 * Reprocessa artefatos fiscais pendentes (XML/DANFE/XML de cancelamento).
 * Não reenvia a NF-e — apenas recupera arquivos do provedor. Idempotente.
 */
export function useReprocessFiscalArtifacts() {
  const fn = useServerFn(reprocessFiscalArtifacts);
  const invalidate = useInvalidateFiscal();
  return useMutation<ReprocessArtifactsResult, Error, string>({
    mutationFn: (documentId: string) => fn({ data: { documentId } }),
    onSuccess: (res) => {
      invalidate(res.document.id, res.document.saleId);
      if (res.stillPending.length > 0) toast.warning(res.message);
      else toast.success(res.message);
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao reprocessar artefatos."),
  });
}

/**
 * Descarta uma tentativa de emissão que falhou, liberando a venda para
 * gerar um NOVO documento fiscal. Nada é apagado.
 */
export function useDiscardFiscalDocument(
  options?: UseMutationOptions<FiscalDocumentDto, Error, { documentId: string; reason?: string }>,
) {
  const fn = useServerFn(discardFiscalDocument);
  const invalidate = useInvalidateFiscal();
  const { onSuccess, onError, ...rest } = options ?? {};
  return useMutation({
    mutationFn: (input) => fn({ data: input }),
    onSuccess: (doc, ...args) => {
      invalidate(doc.id, doc.saleId);
      toast.success("Tentativa descartada. A venda está liberada para nova emissão.");
      (onSuccess as ((d: FiscalDocumentDto, ...a: unknown[]) => void) | undefined)?.(doc, ...args);
    },
    onError: (err, ...args) => {
      toast.error(err.message || "Falha ao descartar a tentativa.");
      (onError as ((e: Error, ...a: unknown[]) => void) | undefined)?.(err, ...args);
    },
    ...rest,
  });
}

export function useExportFiscalXmlsBatch() {
  const fn = useServerFn(exportFiscalXmlsBatch);
  return useMutation({
    mutationFn: (input: { from: string; to: string }) => fn({ data: input }),
    onError: (err: Error) => toast.error(err.message || "Falha ao exportar XMLs."),
  });
}

export function useFiscalArtifact() {
  const fn = useServerFn(getFiscalArtifactUrl);
  return useMutation({
    mutationFn: (path: string) => fn({ data: { path } }),
    onError: (err: Error) => toast.error(err.message || "Falha ao gerar link."),
  });
}

export type UpdateProviderInput = {
  providerId:
    | "mock"
    | "focusnfe"
    | "focus_nfe"
    | "plugnotas"
    | "tecnospeed"
    | "nfe_io";
  environment: NfeEnvironment;
  apiUrl?: string | null;
  notes?: string | null;
  webhookUrl?: string | null;
  apiKey?: string | null;
  /** Credenciais/URLs independentes por ambiente. */
  environments?: Partial<
    Record<
      NfeEnvironment,
      {
        apiUrl?: string | null;
        /** Token da EMPRESA (emissão de NF-e). */
        apiKey?: string | null;
        /** Token PRINCIPAL/Admin (`/v2/empresas`). */
        adminApiKey?: string | null;
      }
    >
  >;
};


export function useUpdateFiscalProvider() {
  const fn = useServerFn(updateFiscalProviderConfig);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProviderInput) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalKeys.provider() });
      toast.success("Provedor atualizado.");
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao salvar provedor."),
  });
}

export function useUploadCertificate() {
  const fn = useServerFn(uploadFiscalCertificate);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      alias: string;
      subjectName: string;
      subjectCnpj: string;
      issuerName?: string | null;
      validFrom: string;
      validTo: string;
      serialNumber?: string | null;
      thumbprint?: string | null;
      fileBase64: string;
      contentType?: string;
    }) => fn({ data: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalKeys.certificates() });
      toast.success("Certificado A1 enviado.");
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao enviar certificado."),
  });
}

export function useDeactivateCertificate() {
  const fn = useServerFn(deactivateFiscalCertificate);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (certificateId: string) => fn({ data: { certificateId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: fiscalKeys.certificates() });
      toast.success("Certificado desativado.");
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao desativar certificado."),
  });
}

// ------------------------------------------------------------------ realtime

/**
 * Escuta mudanças em `fiscal_documents` da empresa e invalida os caches
 * afetados. Deve ser montado uma única vez pelo layout do módulo.
 */
export function useFiscalRealtime(companyId: string | undefined | null) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!companyId) return;
    // Debounce invalidations: coalesce rajadas de eventos em uma única
    // rodada de invalidação, evitando refetch cascade.
    let dashTimer: ReturnType<typeof setTimeout> | null = null;
    const detailTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const invalidateDashboardSoon = () => {
      if (dashTimer) return;
      dashTimer = setTimeout(() => {
        dashTimer = null;
        qc.invalidateQueries({ queryKey: fiscalKeys.dashboard() });
        qc.invalidateQueries({ queryKey: [...fiscalKeys.all, "list"] });
      }, 250);
    };
    const invalidateDetailSoon = (id: string) => {
      if (detailTimers.has(id)) return;
      const t = setTimeout(() => {
        detailTimers.delete(id);
        qc.invalidateQueries({ queryKey: fiscalKeys.detail(id) });
      }, 250);
      detailTimers.set(id, t);
    };

    const channel = supabase
      .channel(`fiscal-documents-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fiscal_documents",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          invalidateDashboardSoon();
          const row = (payload.new ?? payload.old) as { id?: string } | null;
          if (row?.id) invalidateDetailSoon(row.id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fiscal_events",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as { document_id?: string } | null;
          if (row?.document_id) invalidateDetailSoon(row.document_id);
        },
      )
      .subscribe();
    return () => {
      if (dashTimer) clearTimeout(dashTimer);
      detailTimers.forEach((t) => clearTimeout(t));
      detailTimers.clear();
      supabase.removeChannel(channel);
    };
  }, [companyId, qc]);
}
