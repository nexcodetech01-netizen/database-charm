import { Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { CREDIT_PAYMENT_METHOD_OPTIONS } from "@/features/credit";

interface CreditConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  entradaStr: string;
  onEntradaChange: (value: string) => void;
  entradaValue: number;
  entradaExcedeu: boolean;
  entradaNegativa: boolean;
  saldoValue: number;
  installmentsCount: number;
  onInstallmentsCountChange: (count: number) => void;
  creditDownMethod: string;
  onCreditDownMethodChange: (method: string) => void;
  saldoDueDate: string;
  onSaldoDueDateChange: (date: string) => void;
  creditNotes: string;
  onCreditNotesChange: (notes: string) => void;
  submitting: boolean;
  onConfirm: () => void;
}

/** Modal "Configuração do Crediário": entrada, parcelas, vencimento. */
export function CreditConfigDialog({
  open,
  onOpenChange,
  amount,
  entradaStr,
  onEntradaChange,
  entradaValue,
  entradaExcedeu,
  entradaNegativa,
  saldoValue,
  installmentsCount,
  onInstallmentsCountChange,
  creditDownMethod,
  onCreditDownMethodChange,
  saldoDueDate,
  onSaldoDueDateChange,
  creditNotes,
  onCreditNotesChange,
  submitting,
  onConfirm,
}: CreditConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configuração do Crediário</DialogTitle>
          <DialogDescription>
            Defina os termos de pagamento para esta venda.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor da Entrada (R$)</Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={entradaStr}
                onChange={(e) => onEntradaChange(e.target.value)}
                className={cn((entradaExcedeu || entradaNegativa) && "border-destructive focus-visible:ring-destructive")}
              />
              {entradaExcedeu && (
                <p className="text-[10px] text-destructive font-medium">
                  A entrada não pode ser maior que o total ({formatCurrency(amount)}).
                </p>
              )}
              {entradaNegativa && (
                <p className="text-[10px] text-destructive font-medium">
                  O valor da entrada não pode ser negativo.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Nº de Parcelas</Label>
              <Select
                value={String(installmentsCount)}
                onValueChange={(v) => onInstallmentsCountChange(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {entradaValue > 0 && (
            <div className="space-y-2">
              <Label>Forma de Pagamento da Entrada</Label>
              <Select value={creditDownMethod} onValueChange={onCreditDownMethodChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREDIT_PAYMENT_METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primeiro Vencimento</Label>
              <Input
                type="date"
                value={saldoDueDate}
                onChange={(e) => onSaldoDueDateChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Input
                value={creditNotes}
                onChange={(e) => onCreditNotesChange(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          {/* Resumo Visual */}
          <div className="rounded-lg bg-blue-600/5 p-3 border border-primary/10 text-xs">
            <div className="flex justify-between mb-1">
              <span className="text-muted-foreground">Valor total da venda:</span>
              <span className="font-medium text-gray-100">{formatCurrency(amount)}</span>
            </div>
            {entradaValue > 0 && (
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Entrada:</span>
                <span className="font-medium text-emerald-500">-{formatCurrency(entradaValue)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-100 border-t border-primary/10 pt-1 mt-1">
              <span>{installmentsCount} parcelas de:</span>
              <span>{formatCurrency(saldoValue / installmentsCount)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              Serão geradas {installmentsCount} {installmentsCount === 1 ? 'parcela' : 'parcelas'} de {formatCurrency(saldoValue / installmentsCount)} 
              {" "}com 1º vencimento em {new Date(saldoDueDate + "T12:00:00").toLocaleDateString('pt-BR')}.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={submitting || entradaExcedeu || entradaNegativa}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Crediário (F5)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
