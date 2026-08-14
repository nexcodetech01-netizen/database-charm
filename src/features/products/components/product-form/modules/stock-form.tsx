import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Boxes, ArrowUpRight, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface StockFormProps {
  form: any;
  setForm: (val: any) => void;
  isEdit: boolean;
  onOpenMovement: (type: "in" | "adjustment") => void;
}

export function StockForm({ form, setForm, isEdit, onOpenMovement }: StockFormProps) {
  const numValue = parseFloat(String(form.stock).replace(/[^\d.-]/g, "")) || 0;
  const isKit = form.product_type === 'kit';
  
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <Label htmlFor="stock" className="text-base font-semibold">
          {isEdit ? "Saldo em Estoque" : "Estoque Inicial"}
        </Label>
        
        <div className="space-y-3">
          <div className="relative">
            <Input
              id="stock"
              type="number"
              value={form.stock}
              onChange={(e) => {
                setForm((s: any) => ({ ...s, stock: e.target.value }));
              }}
              className={cn(
                "text-lg font-bold tabular-nums pr-12",
                isKit && "text-blue-400 bg-blue-950/20 border-blue-500/50"
              )}

            />
            {isKit && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Package className="h-5 w-5 text-blue-400" />
              </div>
            )}
          </div>
          {isKit ? (
            <div className="space-y-2">
              <p className="text-[10px] text-slate-200 bg-slate-800/80 p-2 rounded-sm border border-blue-500/30 italic flex items-start gap-2">
                <Boxes className="h-3 w-3 mt-0.5 shrink-0 text-blue-400" />
                <span>
                  Calculado via componentes: <strong className="text-blue-400">{form.stock} unid.</strong><br/>
                  O estoque de um kit é o menor saldo disponível entre seus componentes.
                </span>
              </p>
            </div>
          ) : isEdit && (
            <p className="text-[10px] text-muted-foreground">
              Para registrar entradas ou saídas rastreáveis no estoque, utilize os botões <strong>Entrada</strong> ou <strong>Ajuste</strong> abaixo.
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
