import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CreditCard, Loader2, Save } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import {
  paymentMethodsKeys,
  usePaymentMethodFees,
} from "../hooks/use-payment-methods";
import { paymentMethodsService } from "../services/payment-methods.service";
import type { PaymentMethodFee } from "../types";

type Row = {
  id: string;
  method_key: string;
  label: string;
  active: boolean;
  fee_percent: string;
  fee_fixed: string;
  installments: number | null;
  dirty: boolean;
};

const num = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

function toRow(f: PaymentMethodFee): Row {
  return {
    id: f.id,
    method_key: f.method_key,
    label: f.label,
    active: f.active,
    fee_percent: String(f.fee_percent ?? 0),
    fee_fixed: String(f.fee_fixed ?? 0),
    installments: f.installments,
    dirty: false,
  };
}

export function PaymentMethodsSection() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const companyQ = useQuery({
    queryKey: ["settings", "company-basic", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const companyId = companyQ.data?.id ?? null;
  const feesQ = usePaymentMethodFees(companyId);

  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (feesQ.data) setRows(feesQ.data.map(toRow));
  }, [feesQ.data]);

  const save = useMutation({
    mutationFn: async () => {
      const dirty = rows.filter((r) => r.dirty);
      for (const r of dirty) {
        await paymentMethodsService.update({
          id: r.id,
          active: r.active,
          fee_percent: num(r.fee_percent),
          fee_fixed: num(r.fee_fixed),
        });
      }
    },
    onSuccess: () => {
      toast.success("Taxas atualizadas", {
        description: "As novas taxas serão aplicadas nos próximos cálculos.",
      });
      setRows((rs) => rs.map((r) => ({ ...r, dirty: false })));
      qc.invalidateQueries({ queryKey: paymentMethodsKeys.byCompany(companyId) });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Falha ao salvar"),
  });

  const patch = (id: string, mut: (r: Row) => Row) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...mut(r), dirty: true } : r)));

  const dirtyCount = rows.filter((r) => r.dirty).length;

  if (companyQ.isLoading || feesQ.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!companyQ.data) {
    return (
      <EmptyState
        icon={Building2}
        title="Nenhuma empresa vinculada"
        description="Complete o onboarding para configurar as taxas de recebimento."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">
                Taxas dos Meios de Pagamento
              </CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Centralize as taxas de recebimento. Toda venda calcula
                automaticamente o valor líquido, que é usado por Bella IA,
                Painel Executivo e Relatórios. Custos de produto <strong>não</strong> são
                alterados por essas taxas.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden grid-cols-[minmax(0,1fr)_88px_120px_120px] items-center gap-3 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground md:grid">
            <span>Meio de pagamento</span>
            <span className="text-center">Ativo</span>
            <span className="text-right">Taxa (%)</span>
            <span className="text-right">Taxa fixa (R$)</span>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            {rows.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-1 items-center gap-3 p-3 md:grid-cols-[minmax(0,1fr)_88px_120px_120px]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.label}
                  </p>
                  {r.installments ? (
                    <p className="text-[11px] text-muted-foreground">
                      Aplicada em vendas com {r.installments}x parcela
                      {r.installments > 1 ? "s" : ""}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 md:justify-center">
                  <Switch
                    checked={r.active}
                    onCheckedChange={(v) =>
                      patch(r.id, (row) => ({ ...row, active: v }))
                    }
                  />
                  <span className="text-xs text-muted-foreground md:hidden">
                    {r.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground md:hidden">
                    Taxa (%)
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={r.fee_percent}
                    onChange={(e) =>
                      patch(r.id, (row) => ({
                        ...row,
                        fee_percent: e.target.value,
                      }))
                    }
                    className="h-9 text-right tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] font-medium text-muted-foreground md:hidden">
                    Taxa fixa (R$)
                  </Label>
                  <Input
                    inputMode="decimal"
                    value={r.fee_fixed}
                    onChange={(e) =>
                      patch(r.id, (row) => ({
                        ...row,
                        fee_fixed: e.target.value,
                      }))
                    }
                    className="h-9 text-right tabular-nums"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {dirtyCount > 0
            ? `${dirtyCount} alteração(ões) pendente(s)`
            : "Nenhuma alteração pendente."}
        </p>
        <Button
          onClick={() => save.mutate()}
          disabled={dirtyCount === 0 || save.isPending}
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
