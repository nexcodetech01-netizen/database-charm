import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { useResolvedCompanyId } from "@/hooks/use-resolved-company-id";
import { isModuleEnabled, type EnabledModules, type ModuleKey } from "./modules";

const key = (companyId: string | null | undefined) => ["company-modules", companyId];

export function useEnabledModules() {
  const { user } = useAuth();
  const { companyId } = useResolvedCompanyId(user?.id);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: key(companyId),
    enabled: !!companyId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ modules: EnabledModules; ready: boolean }> => {
      const { data, error } = await supabase
        .from("companies")
        // Coluna nova (migration 20261026170000); tipos ainda não gerados.
        .select("enabled_modules" as "id")
        .eq("id", companyId as string)
        .maybeSingle();
      // Sem a coluna (SQL não rodado): tudo ligado, como antes.
      if (error) return { modules: {}, ready: false };
      const raw = (data as { enabled_modules?: unknown } | null)?.enabled_modules;
      return {
        modules: raw && typeof raw === "object" ? (raw as EnabledModules) : {},
        ready: true,
      };
    },
  });

  const modules = q.data?.modules ?? {};

  const toggle = useMutation({
    mutationFn: async ({ module, enabled }: { module: ModuleKey; enabled: boolean }) => {
      if (!companyId) throw new Error("Empresa não encontrada");
      if (q.data && !q.data.ready) throw new Error("Falta rodar o SQL dos módulos no Supabase.");
      const next: EnabledModules = { ...modules, [module]: enabled };
      const { error } = await supabase
        .from("companies")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ enabled_modules: next } as any)
        .eq("id", companyId);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.setQueryData(key(companyId), { modules: next, ready: true });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  return {
    modules,
    isLoading: q.isLoading,
    isEnabled: (m: ModuleKey) => isModuleEnabled(modules, m),
    setEnabled: (m: ModuleKey, enabled: boolean) => toggle.mutate({ module: m, enabled }),
    isSaving: toggle.isPending,
  };
}
