import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Wand2,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import {
  scanLegacySkus,
  applyLegacySkuRename,
  listSkuRenameAudit,
  type LegacySkuRow,
} from "@/features/products/lib/sku-cleanup.functions";

export function SkuCleanupSection() {
  const { user } = useAuth();

  const companyQ = useQuery({
    queryKey: ["settings", "sku-cleanup", "company", user?.id],
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

  const scan = useServerFn(scanLegacySkus);
  const apply = useServerFn(applyLegacySkuRename);
  const listAudit = useServerFn(listSkuRenameAudit);

  const [rows, setRows] = useState<LegacySkuRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [filter, setFilter] = useState("");

  const auditQ = useQuery({
    queryKey: ["sku-rename-audit", companyId],
    enabled: !!companyId,
    queryFn: () => listAudit({ data: { companyId: companyId!, limit: 30 } }),
  });

  const runScan = async () => {
    if (!companyId) return;
    setLoading(true);
    setSelected(new Set());
    setEdits({});
    try {
      const res = await scan({ data: { companyId } });
      setRows(res.rows);
      toast.success(`${res.total} produto(s) legado(s) encontrado(s).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na análise.");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.currentSku.toLowerCase().includes(q) ||
        (r.suggestedSku ?? "").toLowerCase().includes(q),
    );
  }, [rows, filter]);

  const eligibleIds = useMemo(
    () =>
      filtered
        .filter((r) => r.suggestedSku && !r.conflict)
        .map((r) => r.productId),
    [filtered],
  );

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(eligibleIds));
    else setSelected(new Set());
  };

  const applyOne = async (row: LegacySkuRow) => {
    if (!companyId || !row.suggestedSku) return;
    const newSku = (edits[row.productId] ?? row.suggestedSku).trim();
    if (!newSku) {
      toast.error("Informe um SKU válido.");
      return;
    }
    setApplying(true);
    try {
      await apply({
        data: { companyId, productId: row.productId, newSku, source: "single" },
      });
      toast.success(`SKU renomeado: ${row.currentSku} → ${newSku}`);
      setRows((prev) => prev?.filter((r) => r.productId !== row.productId) ?? null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(row.productId);
        return next;
      });
      auditQ.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao renomear.");
    } finally {
      setApplying(false);
    }
  };

  const applyBulk = async () => {
    if (!companyId || selected.size === 0) return;
    setConfirmBulk(false);
    setApplying(true);
    const ids = Array.from(selected);
    let ok = 0;
    let failed = 0;
    for (const id of ids) {
      const row = rows?.find((r) => r.productId === id);
      if (!row?.suggestedSku) {
        failed++;
        continue;
      }
      const newSku = (edits[id] ?? row.suggestedSku).trim();
      try {
        await apply({
          data: { companyId, productId: id, newSku, source: "bulk" },
        });
        ok++;
      } catch {
        failed++;
      }
    }
    setApplying(false);
    setRows((prev) => (prev ? prev.filter((r) => !selected.has(r.productId) || !ok) : prev));
    setSelected(new Set());
    auditQ.refetch();
    if (failed === 0) toast.success(`${ok} SKU(s) padronizado(s).`);
    else toast.warning(`${ok} aplicado(s), ${failed} falharam. Reveja os pendentes.`);
    // reexecuta scan para refletir estado real
    runScan();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wand2 className="h-4 w-4 text-primary" />
            Padronizar SKUs legados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Localiza produtos com SKU no padrão antigo{" "}
            <code className="rounded bg-muted px-1">PROD-XXXXXX</code> e sugere um
            novo SKU no padrão oficial (
            <code className="rounded bg-muted px-1">CAT-MOD-COR-SEQ</code>),
            gerado pela mesma função usada em recebimentos de compras. Apenas o
            campo <strong>SKU do produto</strong> é alterado — vendas, estoque,
            compras e movimentos não são tocados. Todas as renomeações ficam
            registradas na auditoria.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={runScan} disabled={!companyId || loading} size="sm">
              {loading ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              {rows ? "Reanalisar" : "Analisar agora"}
            </Button>

            {rows && (
              <>
                <Input
                  placeholder="Filtrar por nome ou SKU…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="h-9 max-w-xs"
                />
                <Badge variant="secondary">{filtered.length} listado(s)</Badge>
                <Badge variant="outline">
                  {eligibleIds.length} aplicável(is)
                </Badge>
                <div className="ml-auto flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={applying || selected.size === 0}
                    onClick={() => setConfirmBulk(true)}
                  >
                    Aplicar selecionados ({selected.size})
                  </Button>
                </div>
              </>
            )}
          </div>

          {rows && rows.length === 0 && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Nenhum SKU legado encontrado. Catálogo já está padronizado.
            </div>
          )}

          {rows && rows.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          eligibleIds.length > 0 &&
                          selected.size === eligibleIds.length
                        }
                        onCheckedChange={(v) => toggleAll(!!v)}
                        aria-label="Selecionar todos"
                      />
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>SKU atual</TableHead>
                    <TableHead>SKU sugerido</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const eligible = !!r.suggestedSku && !r.conflict;
                    return (
                      <TableRow key={r.productId}>
                        <TableCell>
                          <Checkbox
                            disabled={!eligible}
                            checked={selected.has(r.productId)}
                            onCheckedChange={(v) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(r.productId);
                                else next.delete(r.productId);
                                return next;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{r.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.categoryName ?? "—"}
                        </TableCell>
                        <TableCell>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {r.currentSku}
                          </code>
                        </TableCell>
                        <TableCell>
                          {r.suggestedSku ? (
                            <div className="flex flex-col gap-1">
                              <Input
                                value={edits[r.productId] ?? r.suggestedSku}
                                onChange={(e) =>
                                  setEdits((prev) => ({
                                    ...prev,
                                    [r.productId]: e.target.value,
                                  }))
                                }
                                className="h-8 w-44 font-mono text-xs"
                              />
                              {r.reason && (
                                <span
                                  className={`inline-flex items-center gap-1 text-xs ${
                                    r.conflict
                                      ? "text-red-500"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {r.conflict && (
                                    <AlertTriangle className="h-3 w-3" />
                                  )}
                                  {r.reason}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-red-500">
                              {r.reason ?? "Sem sugestão"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!eligible || applying}
                            onClick={() => applyOne(r)}
                          >
                            Aplicar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Últimas renomeações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {auditQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (auditQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma renomeação registrada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>SKU antigo</TableHead>
                    <TableHead>SKU novo</TableHead>
                    <TableHead>Origem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(auditQ.data ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(a.createdAt).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {a.oldSku}
                        </code>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {a.newSku}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {a.source === "bulk" ? "Lote" : "Individual"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar em lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Serão renomeados <strong>{selected.size}</strong> produto(s). A
              operação altera apenas o campo SKU e é registrada na auditoria.
              Recomenda-se ter um backup recente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applyBulk}>
              Confirmar renomeação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
