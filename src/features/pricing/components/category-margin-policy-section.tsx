/**
 * CategoryCommercialPolicySection
 * ===============================
 * Editor da **Política Comercial** por categoria.
 *
 * Cada categoria define:
 *  - Margem alvo (%)     — usada pela Bella IA e cadastro de produto para o preço sugerido.
 *  - Margem mínima (%)   — piso usado pelo PDV para sinalizar descontos (não bloqueia).
 *  - Desconto padrão (%) — aplicado automaticamente pelo PDV ao adicionar produtos.
 */
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Percent, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCategoriesList, useUpdateCategory } from "@/features/categories";

interface Props {
  companyId: string;
}

type CategoryPolicy = {
  target_margin_pct?: number | null;
  min_margin_pct?: number | null;
  default_discount_pct?: number | null;
};

type Draft = { target: string; min: string; discount: string };

function toInput(v: number | null | undefined): string {
  return v == null || Number.isNaN(v) ? "" : String(v);
}

function parsePct(v: string): number | null {
  const cleaned = v.trim().replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

export function CategoryMarginPolicySection({ companyId }: Props) {
  const { data: categories = [], isLoading } = useCategoriesList(companyId);
  const update = useUpdateCategory();

  const active = useMemo(
    () => categories.filter((c) => c.status === "active"),
    [categories],
  );

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, Draft> = {};
      for (const c of active) {
        const policy = c as unknown as CategoryPolicy;
        next[c.id] =
          prev[c.id] ?? {
            target: toInput(policy.target_margin_pct),
            min: toInput(policy.min_margin_pct),
            discount: toInput(policy.default_discount_pct),
          };
      }
      return next;
    });
  }, [active]);

  const save = async (categoryId: string) => {
    const draft = drafts[categoryId] ?? { target: "", min: "", discount: "" };
    const target = parsePct(draft.target);
    const min = parsePct(draft.min);
    const discount = parsePct(draft.discount);

    if (draft.target.trim() && target === null) {
      toast.error("Margem alvo deve estar entre 0 e 100");
      return;
    }
    if (draft.min.trim() && min === null) {
      toast.error("Margem mínima deve estar entre 0 e 100");
      return;
    }
    if (draft.discount.trim() && discount === null) {
      toast.error("Desconto padrão deve estar entre 0 e 100");
      return;
    }
    if (target != null && min != null && min > target) {
      toast.error("Margem mínima não pode ser maior que a margem alvo");
      return;
    }

    try {
      await update.mutateAsync({
        id: categoryId,
        input: {
          target_margin_pct: target,
          min_margin_pct: min,
          default_discount_pct: discount,
        } as unknown as Parameters<typeof update.mutateAsync>[0]["input"],
      });
      toast.success("Política comercial atualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar política");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Política Comercial por categoria</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Para cada categoria defina <strong>margem alvo</strong>,{" "}
          <strong>margem mínima</strong> e{" "}
          <strong>desconto padrão</strong>. Essas regras alimentam a Bella IA,
          o cadastro de produtos e o PDV. Descontos que deixem a margem
          abaixo do piso apenas sinalizam — não bloqueiam a venda.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando categorias…
          </div>
        ) : active.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Cadastre categorias em <strong>Produtos → Categorias</strong> para
            definir a política comercial.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="w-[160px]">Margem alvo (%)</TableHead>
                <TableHead className="w-[160px]">Margem mínima (%)</TableHead>
                <TableHead className="w-[160px]">Desconto padrão (%)</TableHead>
                <TableHead className="w-[120px] text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((c) => {
                const draft = drafts[c.id] ?? { target: "", min: "", discount: "" };
                const policy = c as unknown as CategoryPolicy;
                const currentTarget = toInput(policy.target_margin_pct);
                const currentMin = toInput(policy.min_margin_pct);
                const currentDiscount = toInput(policy.default_discount_pct);
                const dirty =
                  draft.target !== currentTarget ||
                  draft.min !== currentMin ||
                  draft.discount !== currentDiscount;

                const targetNum = parsePct(draft.target);
                const minNum = parsePct(draft.min);
                const invalidOrder =
                  targetNum != null && minNum != null && minNum > targetNum;

                const patch = (p: Partial<Draft>) =>
                  setDrafts((s) => ({
                    ...s,
                    [c.id]: { ...(s[c.id] ?? { target: "", min: "", discount: "" }), ...p },
                  }));

                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <PctInput
                        value={draft.target}
                        onChange={(v) => patch({ target: v })}
                        onEnter={() => save(c.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <PctInput
                        value={draft.min}
                        onChange={(v) => patch({ min: v })}
                        onEnter={() => save(c.id)}
                      />
                      {invalidOrder ? (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          Mínima não pode ser maior que a alvo.
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <PctInput
                        value={draft.discount}
                        onChange={(v) => patch({ discount: v })}
                        onEnter={() => save(c.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant={dirty ? "default" : "outline"}
                        disabled={!dirty || invalidOrder || update.isPending}
                        onClick={() => save(c.id)}
                      >
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                        Salvar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function PctInput({
  value,
  onChange,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
}) {
  return (
    <div className="relative">
      <Input
        inputMode="decimal"
        placeholder="—"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-8"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter();
          }
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        %
      </span>
    </div>
  );
}

