import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MessageCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { usePrintPreferences } from "@/features/printing";
import {
  buildReceiptHtml,
  buildReceiptRows,
  buildReceiptWhatsappText,
  isSettled,
  type PaymentReceiptData,
} from "../lib/payment-receipt";
import { sanitizePhoneBR } from "../lib/whatsapp-receipt";

export interface PaymentReceiptInfo {
  saleId: string;
  receivedAmount: number;
  paymentMethod: string | null;
  paidAt?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  info: PaymentReceiptInfo | null;
}

async function loadReceipt(
  companyId: string,
  info: PaymentReceiptInfo,
): Promise<{ data: PaymentReceiptData; phone: string | null }> {
  const [{ data: company }, { data: sale }, { data: status }, { data: account }] = await Promise.all([
    supabase.from("companies").select("*").eq("id", companyId).maybeSingle(),
    supabase
      .from("sales")
      .select("number, grand_total, customer_id, customers(name, phone, whatsapp)")
      .eq("id", info.saleId)
      .maybeSingle(),
    (supabase.rpc as any)("compute_sale_payment_status", { _sale_id: info.saleId }),
    supabase.from("credit_accounts").select("id").eq("sale_id", info.saleId).maybeSingle(),
  ]);

  let nextInstallments: PaymentReceiptData["nextInstallments"] = [];
  if (account?.id) {
    const { data: inst } = await supabase
      .from("credit_installments")
      .select("sequence, due_date, amount, paid_amount")
      .eq("credit_account_id", account.id)
      .in("status", ["pending", "partially_paid"])
      .order("sequence", { ascending: true })
      .limit(6);
    nextInstallments = (inst ?? []).map((i) => ({
      sequence: Number(i.sequence),
      dueDate: (i.due_date as string | null) ?? null,
      amount: Math.max(0, Number(i.amount ?? 0) - Number(i.paid_amount ?? 0)),
    }));
  }

  const c = (company ?? {}) as Record<string, any>;
  const customer = (sale as any)?.customers as { name?: string; phone?: string; whatsapp?: string } | null;
  const st = (Array.isArray(status) ? status[0] : status) as { received?: number; remaining?: number } | null;
  const total = Number(sale?.grand_total ?? 0);
  const remaining = st?.remaining != null ? Number(st.remaining) : 0;

  return {
    phone: customer?.whatsapp || customer?.phone || null,
    data: {
      storeName: c.trade_name || c.name || "Loja",
      storeDoc: c.cnpj ? `CNPJ ${c.cnpj}` : null,
      storePhone: c.phone ?? null,
      customerName: customer?.name ?? null,
      saleNumber: sale?.number ?? "",
      paidAt: info.paidAt || new Date().toISOString(),
      receivedAmount: info.receivedAmount,
      paymentMethod: info.paymentMethod,
      saleTotal: total,
      totalPaid: st?.received != null ? Number(st.received) : Math.max(0, total - remaining),
      remaining,
      nextInstallments,
    },
  };
}

/**
 * "Pagamento recebido": aparece depois de uma baixa ou de um pagamento de
 * crediário, com o comprovante para imprimir na térmica ou mandar no
 * WhatsApp. Substitui a tela "Cliente recorrente", que é de venda nova.
 */
export function PaymentReceiptDialog({ open, onOpenChange, companyId, info }: Props) {
  const { prefs } = usePrintPreferences(companyId);
  const { data: receipt, isLoading } = useQuery({
    queryKey: ["payment-receipt", info?.saleId, info?.receivedAmount, info?.paidAt],
    enabled: open && !!info,
    staleTime: 0,
    queryFn: () => loadReceipt(companyId, info!),
  });

  function handlePrint() {
    if (!receipt) return;
    const html = buildReceiptHtml(receipt.data, prefs.paperWidth === "58mm" ? "58mm" : "80mm");
    import("@/features/printing")
      .then(({ printHtmlDocument }) => printHtmlDocument(html, { copies: prefs.copies }))
      .catch(() => toast.error("Falha ao imprimir o comprovante"));
  }

  function handleWhatsapp() {
    if (!receipt) return;
    const text = encodeURIComponent(buildReceiptWhatsappText(receipt.data));
    const phone = receipt.phone ? sanitizePhoneBR(receipt.phone) : "";
    window.open(`https://wa.me/${phone}?text=${text}`, "_blank", "noopener,noreferrer");
  }

  const view = receipt ? buildReceiptRows(receipt.data) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Pagamento recebido
          </DialogTitle>
        </DialogHeader>

        {isLoading || !receipt || !view ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Preparando comprovante…
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div>
              <p className="font-medium">{receipt.data.customerName ?? "Consumidor"}</p>
              <p className="text-xs text-muted-foreground">Venda {receipt.data.saleNumber}</p>
            </div>
            <div className="space-y-1 rounded-md border p-3">
              {view.rows.slice(4).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{label}</span>
                  <span
                    className={
                      label === "Situação"
                        ? "font-semibold text-emerald-600"
                        : label === "Falta pagar"
                          ? "font-semibold text-amber-600"
                          : "tabular-nums"
                    }
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
            {view.installments.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Próximas parcelas</p>
                {view.installments.map(([label, value]) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span>{label}</span>
                    <span className="tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {isSettled(receipt.data) ? (
              <p className="text-xs text-emerald-600">Venda quitada.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ainda falta receber {formatCurrency(receipt.data.remaining)}.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={handleWhatsapp} disabled={!receipt}>
            <MessageCircle className="mr-1.5 h-4 w-4" /> Enviar no WhatsApp
          </Button>
          <Button onClick={handlePrint} disabled={!receipt}>
            <Printer className="mr-1.5 h-4 w-4" /> Imprimir comprovante
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
