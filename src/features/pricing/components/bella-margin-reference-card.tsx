/**
 * BellaMarginReferenceCard — módulo CONSULTIVO
 * ============================================
 * A Bella NÃO define margens. Este card apenas exibe faixas de referência
 * (conservadora / comum / premium) vindas do catálogo configurável
 * `pricing_market_references`, separado da política comercial da empresa.
 * Aplicar é sempre uma ação explícita do usuário — a política da empresa é
 * soberana e nada é recalculado automaticamente.
 */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listMarketReferences,
  upsertCompanyMarketReference,
} from "@/features/pricing/lib/market-references.functions";
import {
  findMarketReference,
  marketReferenceKey,
} from "@/features/pricing/official/market-reference";

interface Props {
  companyId: string;
  categoryName: string | null;
  onApply?: (values: { conservativePct: number; commonPct: number; premiumPct: number }) => void;
}

const num = (s: string): number | null => {
  const n = Number(String(s).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export function BellaMarginReferenceCard({ companyId, categoryName, onApply }: Props) {
  const qc = useQueryClient();
  const queryKey = ["pricing", "market-references", companyId] as const;

  const refs = useQuery({
    queryKey,
    queryFn: () => listMarketReferences({ data: { companyId } }),
    staleTime: 10 * 60_000,
    enabled: Boolean(companyId),
  });

  const reference = findMarketReference(refs.data ?? [], categoryName);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ conservative: "", common: "", premium: "", note: "" });

  useEffect(() => {
    setEditing(false);
    setForm({
      conservative: reference ? String(reference.conservativePct) : "",
      common: reference ? String(reference.commonPct) : "",
      premium: reference ? String(reference.premiumPct) : "",
      note: reference?.sourceNote ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference?.categoryKey, reference?.companyScoped, categoryName]);

  const save = useMutation({
    mutationFn: async () => {
      const conservative = num(form.conservative);
      const common = num(form.common);
      const premium = num(form.premium);
      if (conservative == null || common == null || premium == null) {
        throw new Error("Informe as três faixas em %");
      }
      const res = await upsertCompanyMarketReference({
        data: {
          companyId,
          categoryKey: marketReferenceKey(categoryName ?? ""),
          label: categoryName ?? "",
          conservativePct: conservative,
          commonPct: common,
          premiumPct: premium,
          sourceNote: form.note.trim() || null,
        },
      });
      if (!res.ok) throw new Error(res.error ?? "Falha ao salvar a referência");
      return res;
    },
    onSuccess: async () => {
      toast.success("Referência de mercado atualizada (não altera nenhum produto)");
      setEditing(false);
      await qc.invalidateQueries({ queryKey });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Falha ao salvar a referência"),
  });

  if (!categoryName?.trim()) return null;

  const items = reference
    ? [
        { label: "Conservadora", value: reference.conservativePct },
        { label: "Comum", value: reference.commonPct },
        { label: "Premium", value: reference.premiumPct },
      ]
    : [];

  return (
    <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Bella — referência de mercado
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-[11px]"
          onClick={() => setEditing((v) => !v)}
        >
          <Pencil className="mr-1 h-3 w-3" />
          {editing ? "Fechar" : reference ? "Editar" : "Definir"}
        </Button>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {reference
          ? `Faixa de referência para ${reference.label}. É apenas sugestão: a política da empresa é soberana e nada é recalculado.`
          : "Ainda não há referência cadastrada para esta categoria. Você pode definir uma — ela serve apenas como sugestão."}
      </p>

      {reference ? (
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {items.map((i) => (
            <div key={i.label} className="rounded-md border border-border/60 bg-background p-2">
              <p className="text-[10px] uppercase text-muted-foreground">{i.label}</p>
              <p className="text-sm font-semibold tabular-nums text-foreground">{i.value}%</p>
            </div>
          ))}
        </div>
      ) : null}

      {reference?.sourceNote ? (
        <p className="mt-1.5 text-[10px] italic text-muted-foreground">
          Fonte: {reference.sourceNote}
          {reference.companyScoped ? " · referência própria da empresa" : " · referência global"}
        </p>
      ) : null}

      {editing ? (
        <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-background p-2.5">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["conservative", "Conservadora"],
                ["common", "Comum"],
                ["premium", "Premium"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground">{label} (%)</Label>
                <Input
                  inputMode="decimal"
                  value={form[key]}
                  onChange={(e) => setForm((s) => ({ ...s, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase text-muted-foreground">
              Fonte / observação
            </Label>
            <Input
              value={form.note}
              placeholder="Ex.: pesquisa de concorrentes 08/2026"
              onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Salvando..." : "Salvar referência da empresa"}
          </Button>
        </div>
      ) : null}

      {reference && onApply ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={() =>
            onApply({
              conservativePct: reference.conservativePct,
              commonPct: reference.commonPct,
              premiumPct: reference.premiumPct,
            })
          }
        >
          Usar como ponto de partida
        </Button>
      ) : null}
    </div>
  );
}
