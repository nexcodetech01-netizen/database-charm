import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, Search } from "lucide-react";

interface LogisticsFormProps {
  form: any;
  setForm: (val: any) => void;
  skuGenerating: boolean;
  onRegenerateSku: () => void;
  eanLoading: boolean;
  onEanLookup: () => void;
}

export function LogisticsForm({
  form,
  setForm,
  skuGenerating,
  onRegenerateSku,
  eanLoading,
  onEanLookup,
}: LogisticsFormProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="sku">SKU / Código Interno</Label>
        <div className="flex gap-2">
          <Input
            id="sku"
            placeholder="EX: CAM-ALG-PREM-G"
            value={form.sku}
            onChange={(e) => setForm((s: any) => ({ ...s, sku: e.target.value.toUpperCase() }))}
          />
          <Button
            variant="outline"
            size="icon"
            type="button"
            onClick={onRegenerateSku}
            disabled={skuGenerating}
            title="Gerar SKU automático"
          >
            <RefreshCw className={`h-4 w-4 ${skuGenerating ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="barcode">Código de Barras (EAN/GTIN)</Label>
        <div className="flex gap-2">
          <Input
            id="barcode"
            placeholder="789..."
            value={form.barcode}
            onChange={(e) => setForm((s: any) => ({ ...s, barcode: e.target.value }))}
          />
          <Button
            variant="outline"
            size="icon"
            type="button"
            onClick={onEanLookup}
            disabled={eanLoading}
            title="Buscar por EAN"
          >
            <Search className={`h-4 w-4 ${eanLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:col-span-2">
        <div className="space-y-2">
          <Label htmlFor="weight">Peso (kg)</Label>
          <Input
            id="weight"
            type="number"
            step="0.001"
            value={form.weight}
            onChange={(e) => setForm((s: any) => ({ ...s, weight: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="width">Largura (cm)</Label>
          <Input
            id="width"
            type="number"
            value={form.width}
            onChange={(e) => setForm((s: any) => ({ ...s, width: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="height">Altura (cm)</Label>
          <Input
            id="height"
            type="number"
            value={form.height}
            onChange={(s: any) => setForm((s: any) => ({ ...s, height: s.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="length">Comprimento (cm)</Label>
          <Input
            id="length"
            type="number"
            value={form.length}
            onChange={(e) => setForm((s: any) => ({ ...s, length: e.target.value }))}
          />
        </div>
      </div>
    </div>
  );
}
