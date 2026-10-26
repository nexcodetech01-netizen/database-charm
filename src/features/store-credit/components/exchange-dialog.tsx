import { useMemo, useState } from "react";
import { Repeat } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/format";
import { useReturnedQuantities } from "@/features/returns";
import { PDVCustomerSelect } from "@/features/sales/pdv/components/pdv-customer-select";
import type { SaleItem } from "@/features/sales/types";
import { useCreateExchange } from "../hooks/use-store-credit";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
  saleId: string;
  saleNumber: string;
  saleItems: SaleItem[];
  /** Cliente da venda; sem cliente, o diálogo pede para escolher. */
  saleCustomerId: string | null;
}

interface RowState {
  selected: boolean;
  quantity: string;
}

/**
 * Troca: a peça volta ao estoque e a cliente ganha vale-troca no valor
 * dela. Não sai dinheiro do caixa. O vale é usado depois no PDV.
 */
export function ExchangeDialog({
  open,
  onOpenChange,
  companyId,
  saleId,
  saleNumber,
  saleItems,
  saleCustomerId,
}: Props) {
  const { data: returnedMap } = useReturnedQuantities(saleId);
  const { mutateAsync, isPending } = useCreateExchange();
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [reason, setReason] = useState("Não serviu");
  const [customerId, setCustomerId] = useState("");

  const availableFor = (item: SaleItem) => {
    const returned = returnedMap?.get(item.id) ?? 0;
    return Math.max(0, Number(item.quantity) - returned);
  };
  const unitValue = (item: SaleItem) =>
    Number(item.quantity) > 0
      ? Number(item.total) / Number(item.quantity)
      : Number(item.unit_price);
  const qtyOf = (id: string) => Number((rows[id]?.quantity ?? "").replace(",", ".")) || 0;

  const credit = useMemo(
    () =>
      saleItems.reduce(
        (sum, it) => (rows[it.id]?.selected ? sum + qtyOf(it.id) * unitValue(it) : sum),
        0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saleItems, rows],
  );

  const needsCustomer = !saleCustomerId;
  const valid =
    credit > 0 &&
    (!needsCustomer || !!customerId) &&
    saleItems.every(
      (it) => !rows[it.id]?.selected || (qtyOf(it.id) > 0 && qtyOf(it.id) <= availableFor(it)),
    );

  async function submit() {
    if (!valid) return;
    const items = saleItems
      .filter((it) => rows[it.id]?.selected && qtyOf(it.id) > 0)
      .map((it) => ({
        sale_item_id: it.id,
        product_id: it.product_id,
        description: it.description,
        quantity: qtyOf(it.id),
      }));
    try {
      await mutateAsync({
        companyId,
        saleId,
        customerId: needsCustomer ? customerId : null,
        reason: reason.trim() || "Troca",
        items,
      });
      setRows({});
      setCustomerId("");
      onOpenChange(false);
    } catch {
      /* toast no hook */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" /> Troca — Venda {saleNumber}
          </DialogTitle>
          <DialogDescription>
            Marque a peça que a cliente devolveu. Ela volta para o estoque e a cliente ganha um
            vale-troca no valor dela, para usar agora ou depois no PDV.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div className="rounded-md border border-border">
            {saleItems.map((it) => {
              const st = rows[it.id] ?? { selected: false, quantity: "" };
              const avail = availableFor(it);
              const disabled = avail <= 0;
              return (
                <div
                  key={it.id}
                  className="flex items-center gap-3 border-b border-border px-3 py-2.5 text-sm last:border-b-0"
                >
                  <Checkbox
                    checked={st.selected}
                    disabled={disabled}
                    onCheckedChange={(v) =>
                      setRows((prev) => ({
                        ...prev,
                        [it.id]: {
                          selected: !!v,
                          quantity:
                            v && !prev[it.id]?.quantity
                              ? String(avail)
                              : (prev[it.id]?.quantity ?? ""),
                        },
                      }))
                    }
                    aria-label={`Trocar ${it.description}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{it.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(unitValue(it))} cada ·{" "}
                      {disabled ? "já devolvida" : `${avail} disponível para troca`}
                    </p>
                  </div>
                  {avail > 1 ? (
                    <Input
                      className="h-8 w-16 text-right"
                      value={st.quantity}
                      disabled={!st.selected}
                      inputMode="decimal"
                      aria-label="Quantidade"
                      onChange={(e) =>
                        setRows((prev) => ({
                          ...prev,
                          [it.id]: { selected: true, quantity: e.target.value },
                        }))
                      }
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          {needsCustomer ? (
            <div className="space-y-1.5">
              <Label>
                Cliente <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                A venda foi sem cliente. Escolha quem vai ficar com o vale-troca.
              </p>
              <PDVCustomerSelect
                companyId={companyId}
                value={customerId}
                onChange={setCustomerId}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="exchange-reason">Motivo</Label>
            <Input
              id="exchange-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: não serviu, cor, presente"
            />
          </div>

          <Alert>
            <AlertDescription className="space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span>Vale-troca para a cliente</span>
                <span className="text-base font-semibold">{formatCurrency(credit)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Não sai dinheiro do caixa. Para usar, escolha a cliente no PDV e toque em &quot;Usar
                vale-troca&quot;. Se a peça nova for mais cara, ela paga só a diferença; se for mais
                barata, o resto fica de saldo.
              </p>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending || !valid}>
            {isPending ? "Registrando..." : "Confirmar troca"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
