import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Users } from "lucide-react";
import { PageHeader } from "@/components/layout";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { EmptyState } from "@/components/layout/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/providers/auth-provider";
import { toast } from "sonner";
import {
  getLoyaltySettings,
  saveLoyaltySettings,
  listLoyaltyAccounts,
} from "@/features/loyalty/lib/loyalty-admin.functions";

export const Route = createFileRoute("/_authenticated/fidelidade")({
  component: FidelidadeAdminPage,
});

function FidelidadeAdminPage() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();

  const getSettingsFn = useServerFn(getLoyaltySettings);
  const saveSettingsFn = useServerFn(saveLoyaltySettings);
  const listAccountsFn = useServerFn(listLoyaltyAccounts);

  const { data: settings } = useQuery({
    queryKey: ["loyalty-settings", companyId],
    queryFn: () => getSettingsFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ["loyalty-accounts", companyId],
    queryFn: () => listAccountsFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const [enabled, setEnabled] = useState(false);
  const [pointsPerReal, setPointsPerReal] = useState("1");
  const [redemptionValue, setRedemptionValue] = useState("0.05");

  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled);
      setPointsPerReal(String(settings.points_per_real));
      setRedemptionValue(String(settings.redemption_value_per_point));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveSettingsFn({
        data: {
          companyId: companyId!,
          enabled,
          pointsPerReal: parseFloat(pointsPerReal.replace(",", ".")) || 0,
          redemptionValuePerPoint: parseFloat(redemptionValue.replace(",", ".")) || 0,
        },
      }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Configurações salvas.");
        void queryClient.invalidateQueries({ queryKey: ["loyalty-settings", companyId] });
      } else {
        toast.error(result.error || "Não foi possível salvar.");
      }
    },
  });

  return (
    <div className="space-y-6 p-6">
      <BreadcrumbNav items={[{ label: "Fidelidade" }]} />
      <PageHeader
        title="Programa de Fidelidade"
        description="Clientes ganham pontos automaticamente a cada venda paga, e podem trocar por desconto depois."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4" />
            Configuração
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Programa ativo</p>
              <p className="text-xs text-muted-foreground">
                Enquanto desligado, nenhum ponto é dado nem consultável publicamente.
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Pontos por R$1 gasto</Label>
              <Input value={pointsPerReal} onChange={(e) => setPointsPerReal(e.target.value)} placeholder="1" />
            </div>
            <div>
              <Label>Valor de cada ponto no resgate (R$)</Label>
              <Input
                value={redemptionValue}
                onChange={(e) => setRedemptionValue(e.target.value)}
                placeholder="0,05"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Exemplo com os valores acima: uma compra de R$100 dá {pointsPerReal || 0} × 100 ={" "}
            {(parseFloat(pointsPerReal.replace(",", ".")) || 0) * 100} pontos, valendo{" "}
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
              (parseFloat(pointsPerReal.replace(",", ".")) || 0) *
                100 *
                (parseFloat(redemptionValue.replace(",", ".")) || 0),
            )}{" "}
            numa próxima compra.
          </p>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            Salvar configurações
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Saldo dos clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !accounts || accounts.length === 0 ? (
            <EmptyState
              icon={Gift}
              title="Nenhum cliente com pontos ainda"
              description="Assim que uma venda com cliente vinculado for paga, os pontos aparecem aqui."
            />
          ) : (
            <div className="divide-y">
              {accounts.map((a: any) => (
                <div key={a.customer_id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{a.customers?.name ?? "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">{a.customers?.phone ?? ""}</p>
                  </div>
                  <span className="text-sm font-semibold">{a.points_balance} pts</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
