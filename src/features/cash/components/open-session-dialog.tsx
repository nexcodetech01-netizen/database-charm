import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useOpenCash } from "../hooks/use-cash";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
  operatorId: string;
  operatorName: string;
  onOpened?: () => void;
}

export function OpenSessionDialog({
  open,
  onOpenChange,
  companyId,
  operatorId,
  operatorName,
  onOpened,
}: Props) {
  const [balance, setBalance] = useState("0");
  const [note, setNote] = useState("");
  const { mutateAsync, isPending } = useOpenCash();

  const now = new Date();

  async function submit() {
    const value = Number(balance.replace(",", "."));
    if (Number.isNaN(value) || value < 0) {
      toast.error("Saldo inicial inválido.");
      return;
    }
    try {
      await mutateAsync({
        companyId,
        operatorId,
        operatorName,
        openingBalance: value,
        openingNote: note.trim() || null,
      });
      setBalance("0");
      setNote("");
      onOpenChange(false);
      onOpened?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao abrir caixa.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Abrir caixa</DialogTitle>
          <DialogDescription>
            Registre o troco inicial disponível. Apenas 1 caixa aberto por operador.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Operador</Label>
              <Input value={operatorName} disabled />
            </div>
            <div>
              <Label>Data / Hora</Label>
              <Input value={now.toLocaleString("pt-BR")} disabled />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="opening-balance">Troco inicial (R$)</Label>
            <Input
              id="opening-balance"
              inputMode="decimal"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="0,00"
            />
            <p className="text-xs text-muted-foreground">
              Informe apenas o dinheiro físico disponível para troco. Se não houver
              dinheiro em caixa, mantenha R$ 0,00.
            </p>
          </div>
          <div>
            <Label htmlFor="opening-note">Observação</Label>
            <Textarea
              id="opening-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Opcional"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? "Abrindo…" : "Abrir caixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
