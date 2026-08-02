import { useState } from "react";
import { AlertTriangle, Merge, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { useDuplicateCategories, useMergeCategories } from "../hooks/use-categories";
import type { DuplicateGroupRow } from "../services/categories.service";

/**
 * Saneamento de categorias — prévia + unificação.
 * Só executa após confirmação explícita do usuário. Nunca altera preço,
 * margem, produto, venda ou estoque: apenas a referência de categoria.
 */
export function CategoryDuplicatesPanel({ companyId }: { companyId: string }) {
  const { data = [], isLoading } = useDuplicateCategories(companyId);

  if (isLoading || data.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <h2 className="text-sm font-semibold">
          Categorias equivalentes encontradas ({data.length})
        </h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Nomes equivalentes por plural, acentos, maiúsculas ou espaços. Revise a prévia e
        escolha a categoria que deve permanecer. Produtos, preços e margens não são
        alterados — apenas a referência de categoria.
      </p>
      <div className="space-y-3">
        {data.map((group) => (
          <DuplicateGroupCard key={group.key} group={group} />
        ))}
      </div>
    </div>
  );
}

function DuplicateGroupCard({ group }: { group: DuplicateGroupRow }) {
  const [targetId, setTargetId] = useState(group.suggested_target_id);
  const [confirmConflict, setConfirmConflict] = useState(false);
  const mergeMut = useMergeCategories();

  const target = group.categories.find((c) => c.id === targetId);
  const sources = group.categories.filter((c) => c.id !== targetId);
  const productsToMove = sources.reduce((acc, s) => acc + s.product_count, 0);
  const blocked = group.policy_conflict && !confirmConflict;

  async function handleMerge() {
    try {
      let moved = 0;
      for (const src of sources) {
        const res = await mergeMut.mutateAsync({
          sourceId: src.id,
          targetId,
          confirmPolicyConflict: confirmConflict,
        });
        moved += res.products_moved;
      }
      toast.success(`Unificado em "${target?.name}"`, {
        description: `${moved} produto(s) migrado(s). Nenhum preço ou margem alterado.`,
      });
    } catch (e) {
      toast.error("Não foi possível unificar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {group.categories.map((c) => (
          <Badge key={c.id} variant={c.id === targetId ? "default" : "secondary"}>
            {c.name} · {c.product_count} produto(s)
          </Badge>
        ))}
      </div>

      {group.policy_conflict ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-destructive" />
          <div className="space-y-1">
            <p className="font-medium text-destructive">
              Conflito de política de margem
            </p>
            <ul className="text-muted-foreground">
              {group.categories.map((c) => (
                <li key={c.id}>
                  {c.name}: mín {c.min_margin_pct ?? "—"}% · padrão{" "}
                  {c.target_margin_pct ?? "—"}% · máx {c.max_margin_pct ?? "—"}%
                </li>
              ))}
            </ul>
            <label className="mt-1 flex items-center gap-2">
              <Checkbox
                checked={confirmConflict}
                onCheckedChange={(v) => setConfirmConflict(v === true)}
              />
              <span>
                Confirmo manter a política de <b>{target?.name}</b> após a unificação.
              </span>
            </label>
          </div>
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" /> Políticas idênticas — nada será
          alterado.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Manter categoria</Label>
          <Select value={targetId} onValueChange={setTargetId}>
            <SelectTrigger className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {group.categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.product_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          {productsToMove} produto(s) serão migrados para <b>{target?.name}</b>.
        </p>
        <Button
          size="sm"
          className="ml-auto"
          disabled={blocked || mergeMut.isPending}
          onClick={handleMerge}
        >
          {mergeMut.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Merge className="mr-1.5 h-4 w-4" />
          )}
          Unificar
        </Button>
      </div>
    </div>
  );
}
