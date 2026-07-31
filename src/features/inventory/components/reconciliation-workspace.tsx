import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, PlayCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useInventoryCostSettings,
  useInventoryLedgerAudit,
  useReconcileInventory,
  useReconciliationHistory,
  useUpdateInventoryCostSettings,
} from "../hooks/use-inventory";

function fmt(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

export function InventoryReconciliationWorkspace({ companyId }: { companyId: string }) {
  const ledger = useInventoryLedgerAudit(companyId);
  const history = useReconciliationHistory(companyId);
  const settings = useInventoryCostSettings(companyId);
  const updateSettings = useUpdateInventoryCostSettings(companyId);
  const reconcile = useReconcileInventory(companyId);
  const [preview, setPreview] = useState<
    { name: string; sku: string | null; adjustment: number; status: string }[] | null
  >(null);

  const rows = ledger.data ?? [];
  const inconsistent = useMemo(() => rows.filter((r) => r.inconsistent), [rows]);
  const pendingManual = useMemo(
    () => inconsistent.filter((r) => r.has_opening),
    [inconsistent],
  );

  async function run(dryRun: boolean) {
    try {
      const res = await reconcile.mutateAsync(dryRun);
      setPreview(
        res.items.map((i) => ({
          name: i.name,
          sku: i.sku,
          adjustment: Number(i.adjustment ?? 0),
          status: i.status,
        })),
      );
      if (dryRun) {
        toast.success(
          `Simulação concluída: ${res.simulated} produto(s) receberiam abertura, ${res.pending_manual} exigem análise manual.`,
        );
      } else {
        toast.success(
          `Reconciliação concluída: ${res.reconciled} movimento(s) de abertura criado(s).`,
        );
        await ledger.refetch();
        await history.refetch();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na reconciliação.");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Política de custo</CardTitle>
            <CardDescription>
              Define se a venda pode ser finalizada sem custo registrado no produto.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Switch
            id="allow-sale-without-cost"
            checked={settings.data?.allow_sale_without_cost ?? true}
            disabled={settings.isLoading || updateSettings.isPending}
            onCheckedChange={(checked) =>
              updateSettings.mutate(
                { allow_sale_without_cost: checked },
                {
                  onSuccess: () => toast.success("Política de custo atualizada."),
                  onError: (e) =>
                    toast.error(e instanceof Error ? e.message : "Falha ao salvar."),
                },
              )
            }
          />
          <Label htmlFor="allow-sale-without-cost" className="cursor-pointer">
            Permitir venda sem custo
          </Label>
          <Badge variant={settings.data?.allow_sale_without_cost ? "secondary" : "success"}>
            {settings.data?.allow_sale_without_cost ? "SIM" : "NÃO"}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="text-base">Assistente de reconciliação</CardTitle>
            <CardDescription>
              Cria um único movimento de abertura (Saldo inicial) com a diferença necessária.
              Nenhuma movimentação existente é alterada ou excluída.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={reconcile.isPending}
              onClick={() => run(true)}
            >
              <PlayCircle className="mr-1.5 h-4 w-4" /> Simular
            </Button>
            <Button
              size="sm"
              disabled={reconcile.isPending || inconsistent.length === 0}
              onClick={() => run(false)}
            >
              <ShieldCheck className="mr-1.5 h-4 w-4" /> Reconciliar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              Produtos analisados: <strong>{rows.length}</strong>
            </span>
            <span>
              Inconsistentes: <strong>{inconsistent.length}</strong>
            </span>
            <span>
              Exigem análise manual: <strong>{pendingManual.length}</strong>
            </span>
          </div>
          {preview && preview.length > 0 && (
            <div className="rounded-md border p-3 text-sm">
              <p className="mb-2 font-medium">Resultado da última execução</p>
              <ul className="space-y-1">
                {preview.slice(0, 20).map((p, i) => (
                  <li key={`${p.sku ?? p.name}-${i}`} className="flex justify-between gap-2">
                    <span className="truncate">
                      {p.sku ? `${p.sku} — ` : ""}
                      {p.name}
                    </span>
                    <span className="tabular-nums">
                      {fmt(p.adjustment)} · {p.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Razão de estoque</CardTitle>
            <CardDescription>
              Saldo inicial + entradas − saídas = saldo atual
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => ledger.refetch()}
            disabled={ledger.isFetching}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Saldo inicial</TableHead>
                <TableHead className="text-right">Entradas</TableHead>
                <TableHead className="text-right">Saídas</TableHead>
                <TableHead className="text-right">Razão</TableHead>
                <TableHead className="text-right">Cadastro</TableHead>
                <TableHead className="text-right">Diferença</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    Carregando razão…
                  </TableCell>
                </TableRow>
              )}
              {!ledger.isLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.product_id}>
                  <TableCell className="max-w-[280px] truncate">
                    {r.sku ? <span className="text-muted-foreground">{r.sku} · </span> : null}
                    {r.name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.opening)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.inbound)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.outbound)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.ledger_stock)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.current_stock)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.difference)}</TableCell>
                  <TableCell>
                    {r.inconsistent ? (
                      <Badge variant="danger" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Inconsistente
                      </Badge>
                    ) : (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Conciliado
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auditoria de reconciliação</CardTitle>
          <CardDescription>Registro imutável dos ajustes de abertura criados.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Saldo anterior</TableHead>
                <TableHead className="text-right">Razão</TableHead>
                <TableHead className="text-right">Ajuste</TableHead>
                <TableHead>Abertura</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(history.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Nenhuma reconciliação registrada.
                  </TableCell>
                </TableRow>
              )}
              {(history.data ?? []).map((h) => {
                const row = h as unknown as {
                  id: string;
                  created_at: string;
                  before_stock: number;
                  ledger_stock: number;
                  adjustment: number;
                  opening_movement_created: boolean;
                  product?: { name?: string; sku?: string | null } | null;
                };
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      {new Date(row.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate">
                      {row.product?.sku ? `${row.product.sku} · ` : ""}
                      {row.product?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.before_stock)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.ledger_stock)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(row.adjustment)}</TableCell>
                    <TableCell>
                      {row.opening_movement_created ? (
                        <Badge variant="success">Criada</Badge>
                      ) : (
                        <Badge variant="secondary">—</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
