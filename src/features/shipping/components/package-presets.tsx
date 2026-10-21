import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Package, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Um pacote que a loja usa sempre (ex.: envelope de camiseta). */
export interface PackagePreset {
  id: string;
  name: string;
  format: string; // "1" caixa · "2" rolo · "3" envelope (códigos da SuperFrete)
  weight_kg: number;
  height_cm: number;
  width_cm: number;
  length_cm: number;
  /** Pacote sugerido pelo sistema (ainda não salvo pela loja). */
  builtin?: boolean;
}

/** Sugestões iniciais — somem quando a loja salva os próprios pacotes. */
export const DEFAULT_PRESETS: PackagePreset[] = [
  { id: "d-envelope", name: "Envelope camiseta", format: "3", weight_kg: 0.3, height_cm: 2, width_cm: 25, length_cm: 32, builtin: true },
  { id: "d-caixa-p", name: "Caixa P (bolsa)", format: "1", weight_kg: 1, height_cm: 12, width_cm: 20, length_cm: 30, builtin: true },
  { id: "d-perfume", name: "Perfume", format: "1", weight_kg: 0.5, height_cm: 12, width_cm: 12, length_cm: 18, builtin: true },
];

const presetsKey = (companyId: string | null | undefined) => ["shipping-package-presets", companyId];

// Tabela nova (migration 20261021150000). Tipos ainda não gerados.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const presetsTable = () => (supabase as any).from("shipping_package_presets");

export function usePackagePresets(companyId: string | null | undefined) {
  return useQuery({
    queryKey: presetsKey(companyId),
    enabled: !!companyId,
    queryFn: async (): Promise<{ presets: PackagePreset[]; tableReady: boolean }> => {
      const { data, error } = await presetsTable()
        .select("id, name, format, weight_kg, height_cm, width_cm, length_cm")
        .eq("company_id", companyId)
        .order("created_at");
      // Sem a tabela (SQL ainda não rodado): mostra as sugestões mesmo assim.
      if (error) return { presets: DEFAULT_PRESETS, tableReady: false };
      const rows = (data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        name: String(r.name),
        format: String(r.format),
        weight_kg: Number(r.weight_kg),
        height_cm: Number(r.height_cm),
        width_cm: Number(r.width_cm),
        length_cm: Number(r.length_cm),
      }));
      return { presets: rows.length > 0 ? rows : DEFAULT_PRESETS, tableReady: true };
    },
    staleTime: 5 * 60_000,
  });
}

export interface PackageValues {
  format: string;
  peso_kg: string;
  altura_cm: string;
  largura_cm: string;
  comprimento_cm: string;
}

const toForm = (n: number) => String(n).replace(".", ",");
const fromForm = (s: string) => Number(String(s ?? "").replace(",", "."));

export function presetToValues(p: PackagePreset): PackageValues {
  return {
    format: p.format,
    peso_kg: toForm(p.weight_kg),
    altura_cm: toForm(p.height_cm),
    largura_cm: toForm(p.width_cm),
    comprimento_cm: toForm(p.length_cm),
  };
}

/** Barra de pacotes salvos: 1 clique preenche formato, peso e medidas. */
export function PackagePresetBar({
  companyId,
  current,
  onApply,
}: {
  companyId: string | null | undefined;
  current: PackageValues;
  onApply: (values: PackageValues) => void;
}) {
  const qc = useQueryClient();
  const q = usePackagePresets(companyId);
  const presets = q.data?.presets ?? DEFAULT_PRESETS;
  const tableReady = q.data?.tableReady ?? false;
  const [editing, setEditing] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async (presetName: string) => {
      if (!companyId) throw new Error("Empresa não identificada.");
      if (!tableReady) {
        throw new Error("Falta rodar o SQL dos pacotes salvos no Supabase.");
      }
      // Ao salvar o 1º pacote próprio, as sugestões viram pacotes de verdade
      // (senão sumiriam da lista).
      const builtins = presets.filter((p) => p.builtin);
      const rows = [
        ...builtins.map((p) => ({
          company_id: companyId,
          name: p.name,
          format: p.format,
          weight_kg: p.weight_kg,
          height_cm: p.height_cm,
          width_cm: p.width_cm,
          length_cm: p.length_cm,
        })),
        {
          company_id: companyId,
          name: presetName,
          format: current.format,
          weight_kg: fromForm(current.peso_kg),
          height_cm: fromForm(current.altura_cm),
          width_cm: fromForm(current.largura_cm),
          length_cm: fromForm(current.comprimento_cm),
        },
      ];
      const { error } = await presetsTable().insert(rows);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Pacote salvo.");
      setNaming(false);
      setName("");
      await qc.invalidateQueries({ queryKey: presetsKey(companyId) });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar o pacote."),
  });

  const remove = useMutation({
    mutationFn: async (p: PackagePreset) => {
      if (!companyId) return;
      if (!tableReady) throw new Error("Falta rodar o SQL dos pacotes salvos no Supabase.");
      if (p.builtin) {
        // Remover uma sugestão = salvar as outras como pacotes da loja.
        const rows = presets
          .filter((x) => x.builtin && x.id !== p.id)
          .map((x) => ({
            company_id: companyId,
            name: x.name,
            format: x.format,
            weight_kg: x.weight_kg,
            height_cm: x.height_cm,
            width_cm: x.width_cm,
            length_cm: x.length_cm,
          }));
        if (rows.length > 0) {
          const { error } = await presetsTable().insert(rows);
          if (error) throw error;
        }
        return;
      }
      const { error } = await presetsTable().delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: presetsKey(companyId) }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível apagar."),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pacotes salvos</p>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {editing ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
          {editing ? "Pronto" : "Editar"}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <div key={p.id} className="relative">
            <button
              type="button"
              disabled={editing}
              onClick={() => {
                setActiveId(p.id);
                onApply(presetToValues(p));
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                activeId === p.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background/60 hover:border-primary/50",
              )}
            >
              <Package className="h-3.5 w-3.5" />
              {p.name}
              <span className="text-[10px] text-muted-foreground">
                {toForm(p.weight_kg)} kg
              </span>
            </button>
            {editing ? (
              <button
                type="button"
                aria-label={`Apagar ${p.name}`}
                onClick={() => remove.mutate(p)}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-destructive text-destructive-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>
        ))}
        {naming ? (
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) save.mutate(name.trim());
            }}
          >
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do pacote"
              className="h-8 w-40 text-xs"
            />
            <Button type="submit" size="sm" className="h-8" disabled={!name.trim() || save.isPending}>
              Salvar
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setNaming(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Salvar medidas atuais
          </button>
        )}
      </div>
    </div>
  );
}

/** Faixas de peso, como na SuperFrete. */
export const WEIGHT_STEPS = [0.3, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30];
const CUSTOM = "custom";

export function weightLabel(kg: number) {
  return kg < 1 ? `Até ${Math.round(kg * 1000)} g` : `Até ${String(kg).replace(".", ",")} kg`;
}

/** Peso por faixa ("Até 300 g", "Até 1 kg"...) ou digitado. */
export function WeightPicker({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: boolean;
}) {
  const num = fromForm(value);
  const isStep = WEIGHT_STEPS.includes(num);
  const [custom, setCustom] = useState(!isStep && !!value);
  const showInput = custom || (!isStep && !!value);

  return (
    <div className="space-y-2">
      <Select
        value={showInput ? CUSTOM : isStep ? String(num) : undefined}
        onValueChange={(v) => {
          if (v === CUSTOM) {
            setCustom(true);
            return;
          }
          setCustom(false);
          onChange(toForm(Number(v)));
        }}
      >
        <SelectTrigger className={cn("h-10 bg-background/60", error && "border-destructive")}>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={CUSTOM}>Digitar peso</SelectItem>
          {WEIGHT_STEPS.map((kg) => (
            <SelectItem key={kg} value={String(kg)}>
              {weightLabel(kg)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showInput ? (
        <div className="relative">
          <Input
            autoFocus={custom && !value}
            inputMode="decimal"
            value={value}
            onChange={(e) => onChange(e.target.value.replace(/[^0-9,.]/g, "").replace(".", ","))}
            placeholder="0,350"
            className="h-10 bg-background/60 pr-9"
          />
          <span className="pointer-events-none absolute right-3 top-2.5 text-xs text-muted-foreground">kg</span>
        </div>
      ) : null}
    </div>
  );
}
