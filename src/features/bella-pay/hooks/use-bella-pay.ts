import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { bellaPayService } from "../services/bella-pay.service";
import {
  testAsaasConnection,
  createAsaasCharge,
  cancelAsaasCharge,
} from "../lib/bella-pay.functions";
import { getBellaPayKeyStatus, saveBellaPayApiKeys } from "../lib/bella-pay-keys.functions";
import type { BellaPayEnvironment, BellaPayBillingType } from "../types";

export function useBellaPayConfig(companyId: string) {
  return useQuery({
    queryKey: ["bella-pay", "config", companyId],
    queryFn: () => bellaPayService.getConfig(companyId),
  });
}

export function useBellaPayCharges(companyId: string) {
  return useQuery({
    queryKey: ["bella-pay", "charges", companyId],
    queryFn: () => bellaPayService.listCharges(companyId),
  });
}

export function useBellaPayMetrics(companyId: string) {
  return useQuery({
    queryKey: ["bella-pay", "metrics", companyId],
    queryFn: () => bellaPayService.metrics(companyId),
  });
}

/**
 * Situação das chaves do Asaas (mascaradas). A chave completa nunca chega ao
 * navegador — leitura e gravação acontecem só no servidor.
 */
export function useBellaPayKeyStatus(companyId: string) {
  const fn = useServerFn(getBellaPayKeyStatus);
  return useQuery({
    queryKey: ["bella-pay", "key-status", companyId],
    queryFn: () => fn({ data: { companyId } }),
    enabled: !!companyId,
  });
}

export function useSaveBellaPayConfig(companyId: string) {
  const qc = useQueryClient();
  const saveKeys = useServerFn(saveBellaPayApiKeys);
  return useMutation({
    mutationFn: async (input: {
      /** Só é gravada quando vier preenchida (string não vazia). */
      apiKeySandbox?: string | null;
      /** Só é gravada quando vier preenchida (string não vazia). */
      apiKeyProduction?: string | null;
      environment: BellaPayEnvironment;
      creditCardAbsorbFee?: boolean;
      creditCardFeePercent?: number;
      creditCardMaxInstallments?: number;
      defaultAccountId?: string | null;
    }) => {
      const { apiKeySandbox, apiKeyProduction, ...rest } = input;
      const sandbox = apiKeySandbox?.trim() || undefined;
      const production = apiKeyProduction?.trim() || undefined;
      if (sandbox !== undefined || production !== undefined) {
        await saveKeys({
          data: { companyId, apiKeySandbox: sandbox, apiKeyProduction: production },
        });
      }
      return bellaPayService.upsertConfig({ companyId, ...rest });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bella-pay", "config", companyId] });
      qc.invalidateQueries({ queryKey: ["bella-pay", "key-status", companyId] });
      toast.success("Configuração salva.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });
}


export function useTestBellaPayConnection(companyId: string) {
  const fn = useServerFn(testAsaasConnection);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      apiKey?: string;
      environment: BellaPayEnvironment;
      persist?: boolean;
    }) => fn({ data: { companyId, ...input } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["bella-pay", "config", companyId] });
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao testar."),
  });
}

export function useCreateAsaasCharge(companyId: string) {
  const fn = useServerFn(createAsaasCharge);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      customerId?: string | null;
      saleId?: string | null;
      billingType: BellaPayBillingType;
      value: number;
      dueDate: string;
      description?: string;
      installmentCount?: number;
    }) => fn({ data: { companyId, ...input } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bella-pay", "charges", companyId] });
      qc.invalidateQueries({ queryKey: ["bella-pay", "metrics", companyId] });
      toast.success("Cobrança gerada com sucesso.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao gerar cobrança."),
  });
}


export function useCancelAsaasCharge(companyId: string) {
  const fn = useServerFn(cancelAsaasCharge);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (chargeId: string) => fn({ data: { chargeId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bella-pay", "charges", companyId] });
      qc.invalidateQueries({ queryKey: ["bella-pay", "metrics", companyId] });
      toast.success("Cobrança cancelada.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao cancelar."),
  });
}
