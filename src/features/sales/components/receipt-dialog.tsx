import { useEffect, useState } from "react";
import { CheckCircle2, FileText, MessageCircle, Plus, Printer, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SaleReceipt, type ReceiptWidth } from "./sale-receipt";
import {
  buildReceiptWhatsAppMessage,
  openWhatsAppWithMessage,
  sanitizePhoneBR,
} from "../lib/whatsapp-receipt";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saleId: string;
  companyId: string;
  paymentMethod?: string | null;
  pixQrBase64?: string | null;
  pixPayload?: string | null;
  pixExpiration?: string | null;
  pixPaid?: boolean;
  operatorName?: string | null;
  /** Ao clicar em "Ver Venda" após impressão. */
  onViewSale?: () => void;
  /** Ao clicar em "Nova Venda" após impressão (sem navegar). */
  onNewSale?: () => void;
}

export function ReceiptDialog(props: Props) {
  const { open, onOpenChange, onViewSale, onNewSale, ...receiptProps } = props;
  const [width, setWidth] = useState<ReceiptWidth>("80mm");
  const [printed, setPrinted] = useState(false);
  const [waLoading, setWaLoading] = useState(false);
  const [phonePrompt, setPhonePrompt] = useState<{ message: string } | null>(null);
  const [phoneInput, setPhoneInput] = useState("");

  useEffect(() => {
    if (!open) {
      setPrinted(false);
      setPhonePrompt(null);
      setPhoneInput("");
    }
  }, [open]);

  function handlePrint() {
    window.print();
    setPrinted(true);
  }

  async function handleSendWhatsApp() {
    try {
      setWaLoading(true);
      const built = await buildReceiptWhatsAppMessage({
        saleId: props.saleId,
        companyId: props.companyId,
        paymentMethod: props.paymentMethod ?? null,
      });
      if (built.customerPhone) {
        openWhatsAppWithMessage(built.customerPhone, built.message);
        toast.success("WhatsApp aberto com o cupom.");
      } else {
        setPhonePrompt({ message: built.message });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Falha ao preparar mensagem.",
      );
    } finally {
      setWaLoading(false);
    }
  }

  function handleConfirmPhonePrompt() {
    const digits = sanitizePhoneBR(phoneInput);
    if (digits.length < 12) {
      toast.error("Informe um telefone válido com DDD.");
      return;
    }
    if (!phonePrompt) return;
    openWhatsAppWithMessage(digits, phonePrompt.message);
    setPhonePrompt(null);
    setPhoneInput("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 no-print">
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>Cupom não fiscal</span>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5 text-xs">
              {(["58mm", "80mm"] as ReceiptWidth[]).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWidth(w)}
                  className={`rounded px-2 py-0.5 font-mono transition ${
                    width === w
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </DialogTitle>
        </DialogHeader>

        {printed ? (
          <div className="no-print shrink-0 flex items-center gap-3 border-b border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-emerald-600">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div className="text-sm font-medium">
              Cupom enviado para impressão
            </div>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto bg-muted/30 p-4 no-print-bg">
          <div className="receipt-print-area mx-auto">
            <SaleReceipt {...receiptProps} width={width} />
          </div>
        </div>

        <DialogFooter className="shrink-0 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-background px-4 py-3 no-print">
          {printed ? (
            <>
              {onViewSale ? (
                <Button type="button" variant="ghost" size="sm" onClick={onViewSale} className="px-3 py-2 text-sm">
                  <FileText className="mr-1.5 h-4 w-4" /> Ver venda
                </Button>
              ) : null}
              {onNewSale ? (
                <Button type="button" size="sm" onClick={onNewSale} className="px-3 py-2 text-sm">
                  <Plus className="mr-1.5 h-4 w-4" /> Nova venda
                </Button>
              ) : (
                <Button type="button" size="sm" onClick={() => onOpenChange(false)} className="px-3 py-2 text-sm">
                  <X className="mr-1.5 h-4 w-4" /> Fechar
                </Button>
              )}
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="px-3 py-2 text-sm">
                <X className="mr-1.5 h-4 w-4" /> Fechar
              </Button>
              <Button type="button" size="sm" onClick={handlePrint} className="px-3 py-2 text-sm">
                <Printer className="mr-1.5 h-4 w-4" /> Imprimir cupom
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSendWhatsApp}
                disabled={waLoading}
                className="bg-[#25D366] px-3 py-2 text-sm text-white hover:bg-[#1ebe5d] focus-visible:ring-[#25D366]"
              >
                <MessageCircle className="mr-1.5 h-4 w-4" />
                {waLoading ? "Preparando…" : "Enviar por WhatsApp"}
              </Button>
            </>
          )}
        </DialogFooter>


        {phonePrompt ? (
          <div className="no-print shrink-0 border-t border-border bg-muted/40 px-4 py-3">
            <Label htmlFor="wa-phone" className="text-xs font-medium">
              Cliente sem telefone cadastrado. Informe o WhatsApp:
            </Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="wa-phone"
                autoFocus
                inputMode="tel"
                placeholder="(11) 99999-9999"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmPhonePrompt();
                }}
              />
              <Button
                type="button"
                onClick={handleConfirmPhonePrompt}
                className="bg-[#25D366] text-white hover:bg-[#1ebe5d]"
              >
                Enviar
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPhonePrompt(null);
                  setPhoneInput("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
