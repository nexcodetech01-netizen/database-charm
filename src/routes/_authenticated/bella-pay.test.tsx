import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/features/rbac";
import {
  testCreateCustomer,
  testCreateCharge,
  testGetCharge,
  testSimulateReceive,
  testInspectWebhook,
} from "@/features/bella-pay/lib/bella-pay-tests.functions";

export const Route = createFileRoute("/_authenticated/bella-pay/test")({
  beforeLoad: () => {
    // ownership check acontece nas server fns; aqui só evita rota crua
  },
  component: BellaPayTestPage,
});

interface StepLog {
  step: string;
  ok: boolean;
  at: string;
  payload: unknown;
}

function BellaPayTestPage() {
  const { company } = Route.useRouteContext() as {
    company: { id: string; name: string };
  };
  const { isOwner, hasAny } = usePermissions();
  const canAccess = isOwner || hasAny(["bella_pay.manage", "settings.manage"]);

  const [logs, setLogs] = useState<StepLog[]>([]);
  const [customerForm, setCustomerForm] = useState({
    name: "Cliente Teste NexOS",
    cpfCnpj: "24971563792", // CPF fictício válido para sandbox
    email: "teste@nexos.dev",
    phone: "",
  });
  const [asaasCustomerId, setAsaasCustomerId] = useState("");
  const [chargeForm, setChargeForm] = useState<{
    billingType: "PIX" | "BOLETO" | "UNDEFINED";
    value: string;
    dueDate: string;
  }>({
    billingType: "PIX",
    value: "10.00",
    dueDate: new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10),
  });
  const [chargeId, setChargeId] = useState("");

  function log(step: string, ok: boolean, payload: unknown) {
    setLogs((prev) => [
      { step, ok, at: new Date().toISOString(), payload },
      ...prev,
    ]);
  }

  const createCustomer = useServerFn(testCreateCustomer);
  const createCharge = useServerFn(testCreateCharge);
  const getCharge = useServerFn(testGetCharge);
  const simulate = useServerFn(testSimulateReceive);
  const inspect = useServerFn(testInspectWebhook);

  const mCustomer = useMutation({
    mutationFn: () =>
      createCustomer({
        data: { companyId: company.id, ...customerForm },
      }),
    onSuccess: (res) => {
      log("1. Criar cliente", res.ok, res);
      const id = (res.response as { id?: string } | null)?.id;
      if (id) setAsaasCustomerId(id);
    },
    onError: (e) => log("1. Criar cliente", false, { error: String(e) }),
  });

  const mCharge = useMutation({
    mutationFn: () =>
      createCharge({
        data: {
          companyId: company.id,
          customerId: asaasCustomerId,
          billingType: chargeForm.billingType,
          value: Number(chargeForm.value),
          dueDate: chargeForm.dueDate,
          description: `Teste ${chargeForm.billingType} — NexOS`,
        },
      }),
    onSuccess: (res) => {
      log(`2. Criar cobrança (${chargeForm.billingType})`, res.charge.ok, res);
      const id = (res.charge.response as { id?: string } | null)?.id;
      if (id) setChargeId(id);
    },
    onError: (e) => log("2. Criar cobrança", false, { error: String(e) }),
  });

  const mGet = useMutation({
    mutationFn: () =>
      getCharge({ data: { companyId: company.id, chargeId } }),
    onSuccess: (res) => log("5. Consultar status", res.ok, res),
    onError: (e) => log("5. Consultar status", false, { error: String(e) }),
  });

  const mSim = useMutation({
    mutationFn: () =>
      simulate({ data: { companyId: company.id, chargeId } }),
    onSuccess: (res) => log("6. Simular recebimento (sandbox)", res.ok, res),
    onError: (e) =>
      log("6. Simular recebimento (sandbox)", false, { error: String(e) }),
  });

  const mInspect = useMutation({
    mutationFn: () =>
      inspect({
        data: { companyId: company.id, asaasChargeId: chargeId },
      }),
    onSuccess: (res) =>
      log("7+8. Webhook & venda", res.receivedWebhook && res.saleUpdated, res),
    onError: (e) => log("7+8. Webhook & venda", false, { error: String(e) }),
  });

  const anyLoading = useMemo(
    () =>
      [mCustomer, mCharge, mGet, mSim, mInspect].some((m) => m.isPending),
    [mCustomer, mCharge, mGet, mSim, mInspect],
  );

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Acesso
              restrito
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Apenas administradores podem executar o painel de testes do
            Asaas.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Bella Pay — Testes internos
          </h1>
          <Badge variant="outline">Admin</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Valide todo o fluxo Asaas ponta a ponta antes de migrar para
          produção. Nenhuma lógica de negócio existente é alterada — este
          painel apenas invoca a API e inspeciona o resultado.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 1. Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>1. Criar cliente no Asaas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input
                  value={customerForm.name}
                  onChange={(e) =>
                    setCustomerForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>CPF/CNPJ</Label>
                <Input
                  value={customerForm.cpfCnpj}
                  onChange={(e) =>
                    setCustomerForm((f) => ({
                      ...f,
                      cpfCnpj: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>E-mail</Label>
                <Input
                  value={customerForm.email}
                  onChange={(e) =>
                    setCustomerForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input
                  value={customerForm.phone}
                  onChange={(e) =>
                    setCustomerForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
            </div>
            <Button
              onClick={() => mCustomer.mutate()}
              disabled={mCustomer.isPending}
            >
              {mCustomer.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Criar cliente
            </Button>
            {asaasCustomerId ? (
              <p className="text-xs text-muted-foreground">
                Asaas customer id:{" "}
                <code className="rounded bg-muted px-1">
                  {asaasCustomerId}
                </code>
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* 2-4. Cobrança */}
        <Card>
          <CardHeader>
            <CardTitle>2/3/4. Criar cobrança</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select
                  value={chargeForm.billingType}
                  onValueChange={(v) =>
                    setChargeForm((f) => ({
                      ...f,
                      billingType: v as typeof f.billingType,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="UNDEFINED">
                      Link de pagamento
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={chargeForm.value}
                  onChange={(e) =>
                    setChargeForm((f) => ({ ...f, value: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Vencimento</Label>
                <Input
                  type="date"
                  value={chargeForm.dueDate}
                  onChange={(e) =>
                    setChargeForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                />
              </div>
            </div>
            <Input
              placeholder="Asaas customer id"
              value={asaasCustomerId}
              onChange={(e) => setAsaasCustomerId(e.target.value)}
            />
            <Button
              onClick={() => mCharge.mutate()}
              disabled={!asaasCustomerId || mCharge.isPending}
            >
              {mCharge.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Gerar cobrança
            </Button>
            {chargeId ? (
              <p className="text-xs text-muted-foreground">
                Charge id:{" "}
                <code className="rounded bg-muted px-1">{chargeId}</code>
              </p>
            ) : null}
          </CardContent>
        </Card>

        {/* 5-8. Diagnóstico */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>5-8. Status, simulação, webhook e venda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Charge id Asaas"
              value={chargeId}
              onChange={(e) => setChargeId(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!chargeId || mGet.isPending}
                onClick={() => mGet.mutate()}
              >
                5. Consultar status
              </Button>
              <Button
                variant="outline"
                disabled={!chargeId || mSim.isPending}
                onClick={() => mSim.mutate()}
              >
                6. Simular recebimento (Sandbox)
              </Button>
              <Button
                variant="outline"
                disabled={!chargeId || mInspect.isPending}
                onClick={() => mInspect.mutate()}
              >
                7+8. Inspecionar webhook e venda
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A simulação e a confirmação real dependem do webhook oficial
              chegar em <code>/api/public/bella-pay/webhook/&lt;token&gt;</code>.
              O passo 7+8 lê eventos armazenados no Postgres e verifica se a
              venda associada foi marcada como paga.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Log em tempo real{" "}
            {anyLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma chamada ainda.
            </p>
          ) : (
            <ul className="space-y-3">
              {logs.map((l, i) => (
                <li
                  key={i}
                  className="rounded-lg border bg-card p-3 text-sm shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium">
                      {l.ok ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      {l.step}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(l.at).toLocaleTimeString("pt-BR")}
                    </span>
                  </div>
                  <pre className="max-h-80 overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(l.payload, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
