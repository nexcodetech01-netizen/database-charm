import { useEffect, useState } from "react";
import { BRLCurrencyInput } from "@/components/ui/brl-currency-input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Package, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { useResolvedCompanyId } from "@/hooks/use-resolved-company-id";
import { operationalDefaultsKey } from "../../hooks/use-operational-defaults";

type OperationalForm = {
  default_freight: string;
  default_packaging: string;
  default_insurance: string;
  default_other_costs: string;
};

const empty: OperationalForm = {
  default_freight: "0",
  default_packaging: "0",
  default_insurance: "0",
  default_other_costs: "0",
};

function num(v: string | number) {
  if (typeof v === "number") return v;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function CustosOperacionaisSection() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { companyId, isLoading: companyLoading } = useResolvedCompanyId(user?.id);

  const companyQ = useQuery({
    queryKey: ["settings", "company-operational", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, default_freight, default_packaging, default_insurance, default_other_costs")
        .eq("id", companyId as string)
        .maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState<OperationalForm>(empty);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const d = companyQ.data;
    if (!d) return;
    setForm({
      default_freight: String(d.default_freight ?? 0),
      default_packaging: String(d.default_packaging ?? 0),
      default_insurance: String(d.default_insurance ?? 0),
      default_other_costs: String(d.default_other_costs ?? 0),
    });
    setDirty(false);
  }, [companyQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não encontrada");
      const { error } = await supabase
        .from("companies")
        .update({
          default_freight: num(form.default_freight),
          default_packaging: num(form.default_packaging),
          default_insurance: num(form.default_insurance),
          default_other_costs: num(form.default_other_costs),
        })
        .eq("id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Custos operacionais atualizados", {
        description: "Serão aplicados apenas aos próximos produtos cadastrados.",
      });
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["settings", "company-operational"] });
      qc.invalidateQueries({ queryKey: operationalDefaultsKey(companyId) });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao salvar"),
  });

  const set = <K extends keyof OperationalForm>(k: K, v: string) => {
    setForm((s) => ({ ...s, [k]: v }));
    setDirty(true);
  };

  if (companyLoading || companyQ.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!companyId || !companyQ.data) {
    return (
      <EmptyState
        icon={Building2}
        title="Nenhuma empresa vinculada"
        description="Complete o onboarding para configurar os custos padrão."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Custos operacionais padrão</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Aplicados automaticamente ao cadastrar novos produtos. Cada
                produto pode sobrescrever esses valores individualmente. Alterar
                aqui <strong>não afeta</strong> produtos já cadastrados.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Frete padrão (R$)">
            <BRLCurrencyInput
              value={num(form.default_freight)}
              onValueChange={(val) => set("default_freight", String(val))}
            />
          </Field>
          <Field label="Embalagem padrão (R$)">
            <BRLCurrencyInput
              value={num(form.default_packaging)}
              onValueChange={(val) => set("default_packaging", String(val))}
            />
          </Field>
          <Field label="Seguro padrão (R$)">
            <BRLCurrencyInput
              value={num(form.default_insurance)}
              onValueChange={(val) => set("default_insurance", String(val))}
            />
          </Field>
          <Field label="Outros custos padrão (R$)">
            <BRLCurrencyInput
              value={num(form.default_other_costs)}
              onValueChange={(val) => set("default_other_costs", String(val))}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => save.mutate()}
          disabled={!dirty || save.isPending}
        >
          {save.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-4 w-4" />
          )}
          Salvar alterações
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
