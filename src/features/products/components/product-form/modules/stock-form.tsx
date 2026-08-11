import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Boxes, ArrowUpRight } from "lucide-react";

interface StockFormProps {
  form: any;
  setForm: (val: any) => void;
  isEdit: boolean;
  onOpenMovement: (type: "in" | "adjustment") => void;
}

export function StockForm({ form, setForm, isEdit, onOpenMovement }: StockFormProps) {
  const numValue = parseFloat(String(form.stock).replace(/[^\d.-]/g, "")) || 0;
  
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <Label htmlFor="stock" className="text-base font-semibold">
          {isEdit ? "Saldo em Estoque" : "Estoque Inicial"}
        </Label>
        
        <div className="space-y-3">
          <Input
            id="stock"
            type="number"
            value={form.stock}
            onChange={(e) => {
              if (form.product_type === 'kit') return;
              setForm((s: any) => ({ ...s, stock: e.target.value }));
            }}
            disabled={form.product_type === 'kit'}
            className="text-lg font-bold tabular-nums"
          />
          {form.product_type === 'kit' && (
            <p className="text-[10px] text-blue-400 font-bold">
              Estoque calculado pelo item gargalo da composição.
            </p>
          )}
          
          {isEdit && form.product_type !== 'kit' && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="flex-1 gap-2"
                onClick={() => onOpenMovement("in")}
              >
                <ArrowUpRight className="h-4 w-4" />
                Entrada
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="flex-1 gap-2"
                onClick={() => onOpenMovement("adjustment")}
              >
                <Boxes className="h-4 w-4" />
                Ajuste
              </Button>
            </div>
          )}
          
          {numValue <= 0 && (
            <p className="text-xs font-medium text-destructive animate-pulse">
              ⚠️ Produto sem saldo disponível
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <Label htmlFor="min_stock" className="text-base font-semibold text-muted-foreground">
          Estoque Mínimo (Alerta)
        </Label>
        <Input
          id="min_stock"
          type="number"
          value={form.min_stock}
          onChange={(e) => setForm((s: any) => ({ ...s, min_stock: e.target.value }))}
          placeholder="Ex: 5"
          className="tabular-nums"
        />
        <p className="text-[10px] text-muted-foreground">
          O sistema emitirá alertas de reposição quando o estoque atingir este valor.
        </p>
      </div>
    </div>
  );
}
