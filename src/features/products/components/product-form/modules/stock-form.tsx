import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Boxes, ArrowUpRight } from "lucide-react";
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
          <Input
            id="stock"
            type="number"
            value={form.stock}
            onChange={(e) => {
              if (isKit) return;
              setForm((s: any) => ({ ...s, stock: e.target.value }));
            }}
            className="text-lg font-bold tabular-nums"
            disabled={isEdit || isKit}
            readOnly={isEdit || isKit}
          />
          {isKit ? (
            <p className="text-[10px] text-muted-foreground bg-blue-50/50 p-2 rounded-sm border border-blue-100 italic">
              O estoque de um kit é calculado automaticamente com base no menor saldo disponível entre seus componentes.
            </p>
          ) : isEdit && (
            <p className="text-[10px] text-muted-foreground">
              O saldo não pode ser editado direto aqui — o sistema bloqueia essa alteração no banco
              de dados (o valor precisa passar por uma movimentação, para manter o histórico
              correto). Use os botões <strong>Entrada</strong> ou <strong>Ajuste</strong> abaixo.
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
