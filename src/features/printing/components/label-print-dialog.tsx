import { useMemo, useState } from "react";
import { Printer, Tag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  LABEL_LAYOUT_LIST,
  buildLabelCss,
  buildLabelsDocument,
  expandLabelCopies,
  renderLabelHtml,
  resolveLabelLayout,
  type LabelItem,
} from "../lib/labels";
import { printHtmlDocument } from "../lib/printer";
import { usePrintPreferences } from "../hooks/use-print-preferences";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string | null | undefined;
  item: LabelItem;
}

/**
 * Impressão de etiquetas de produto (Sprint 4.0).
 * Puramente de apresentação: não altera produto, estoque ou preço.
 */
export function LabelPrintDialog({ open, onOpenChange, companyId, item }: Props) {
  const { prefs, save } = usePrintPreferences(companyId);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const [copies, setCopies] = useState(1);
  const [showQrCode, setShowQrCode] = useState(false);

  const layout = resolveLabelLayout(layoutId ?? prefs.labelLayout);

  const previewHtml = useMemo(
    () =>
      `<style>${buildLabelCss(layout)}</style>${renderLabelHtml(item, layout, { showQrCode })}`,
    [item, layout, showQrCode],
  );

  async function handlePrint() {
    const items = expandLabelCopies(item, copies);
    const html = buildLabelsDocument(items, layout, {
      showQrCode,
      title: `Etiquetas — ${item.name}`,
    });
    await printHtmlDocument(html);
    if (companyId && layout.id !== prefs.labelLayout) {
      save({ ...prefs, labelLayout: layout.id });
    }
    toast.success(`${items.length} etiqueta(s) enviada(s) para impressão.`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" /> Imprimir etiquetas
          </DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Layout</Label>
              <Select value={layout.id} onValueChange={setLayoutId}>
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
            <div className="space-y-1.5">
              <Label htmlFor="label-copies" className="text-xs text-muted-foreground">
                Quantidade
              </Label>
              <Input
                id="label-copies"
                type="number"
                min={1}
                max={200}
                value={copies}
                onChange={(e) => setCopies(Number(e.target.value))}
              />
            </div>
          </div>

          {layout.supportsQrCode && item.qrCodeDataUrl ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={showQrCode}
                onCheckedChange={(v) => setShowQrCode(!!v)}
              />
              Incluir QR Code
            </label>
          ) : null}

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="mb-2 text-xs text-muted-foreground">Pré-visualização</p>
            <div
              className="mx-auto bg-white text-black shadow-sm [&_.label]:!h-auto"
              style={{ width: `${layout.widthMm}mm` }}
              // Conteúdo gerado localmente pelo renderizador de etiquetas.
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="mr-1.5 h-4 w-4" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
