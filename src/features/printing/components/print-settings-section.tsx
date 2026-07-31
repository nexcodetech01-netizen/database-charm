import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Save } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { usePrintPreferences } from "../hooks/use-print-preferences";
import type { PrintPreferences } from "../lib/print-preferences";
import { describePrinter } from "../lib/printer";
import { LABEL_LAYOUT_LIST } from "../lib/labels";

/**
 * Configurações de impressão (Sprint 4.0).
 * Preferências locais por empresa — nenhuma alteração de banco.
 */
export function PrintSettingsSection() {
  const { user } = useAuth();
  const companyQ = useQuery({
    queryKey: ["settings", "company", user?.id],
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
  const { prefs, save, capabilities } = usePrintPreferences(companyId);
  const [draft, setDraft] = useState<PrintPreferences | null>(null);

  const current = draft ?? prefs;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(prefs);
  const update = (patch: Partial<PrintPreferences>) =>
    setDraft({ ...current, ...patch });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm">Impressão</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Impressora padrão, largura do papel, margens e cópias.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
            Detectado: <span className="font-medium text-foreground">{describePrinter(current, capabilities)}</span>
            <div className="mt-1">
              {capabilities.webUsb || capabilities.webSerial
                ? "ESC/POS disponível neste navegador."
                : "ESC/POS indisponível — será usada a impressão do navegador."}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="printer-name" className="text-xs text-muted-foreground">
                Impressora padrão
              </Label>
              <Input
                id="printer-name"
                placeholder="Ex.: Epson TM-T20"
                value={current.printerName}
                onChange={(e) => update({ printerName: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Largura do papel</Label>
              <Select
                value={current.paperWidth}
                onValueChange={(v) =>
                  update({ paperWidth: v === "58mm" ? "58mm" : "80mm" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="58mm">58 mm</SelectItem>
                  <SelectItem value="80mm">80 mm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="printer-margin" className="text-xs text-muted-foreground">
                Margem (mm)
              </Label>
              <Input
                id="printer-margin"
                type="number"
                min={0}
                max={20}
                value={current.marginMm}
                onChange={(e) => update({ marginMm: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="printer-copies" className="text-xs text-muted-foreground">
                Número de cópias
              </Label>
              <Input
                id="printer-copies"
                type="number"
                min={1}
                max={5}
                value={current.copies}
                onChange={(e) => update({ copies: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Layout padrão de etiquetas
              </Label>
              <Select
                value={current.labelLayout}
                onValueChange={(v) => update({ labelLayout: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_LAYOUT_LIST.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-3 transition hover:bg-muted/40">
              <Checkbox
                checked={current.autoPrintAfterSale}
                onCheckedChange={(v) => update({ autoPrintAfterSale: !!v })}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium">
                  Impressão automática após a venda
                </div>
                <div className="text-xs text-muted-foreground">
                  Abre o cupom e dispara a impressão assim que o pagamento é
                  confirmado no PDV.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 p-3 transition hover:bg-muted/40">
              <Checkbox
                checked={current.preferEscPos}
                onCheckedChange={(v) => update({ preferEscPos: !!v })}
                className="mt-0.5"
              />
              <div>
                <div className="text-sm font-medium">
                  Usar ESC/POS quando suportado
                </div>
                <div className="text-xs text-muted-foreground">
                  Se o navegador não suportar, o sistema usa a impressão padrão
                  automaticamente.
                </div>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => {
            if (!draft) return;
            save(draft);
            setDraft(null);
            toast.success("Preferências de impressão atualizadas.");
          }}
          disabled={!dirty}
        >
          <Save className="mr-2 h-4 w-4" /> Salvar alterações
        </Button>
      </div>
    </div>
  );
}
