import { memo } from "react";
import { Copy, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPixMessage, copyToClipboard, openWhatsApp } from "../../../lib/checkout-messages";

interface PixManualPanelProps {
  ownPixPayload: string | null;
  ownPixQrDataUrl: string | null;
  whatsappNumber: string | null;
  customerName: string | null;
  companyName: string | null;
  amount: number;
}

/** PIX próprio: QR Code + copia e cola + compartilhar no WhatsApp. */
export const PixManualPanel = memo(function PixManualPanel({
  ownPixPayload,
  ownPixQrDataUrl,
  whatsappNumber,
  customerName,
  companyName,
  amount,
}: PixManualPanelProps) {
  return (
    <div className="space-y-3">
      {!ownPixPayload ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
          Configure a <strong>Chave PIX</strong> e o <strong>Nome / Cidade do recebedor</strong> em
          {" "}<em>Configurações → Empresa → PIX Próprio</em> para gerar o QR Code.
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          {ownPixQrDataUrl ? (
            <img
              src={ownPixQrDataUrl}
              alt="QR Code PIX Próprio"
              className="h-48 w-48 rounded-md border border-border bg-white p-2"
            />
          ) : (
            <div className="grid h-48 w-48 place-items-center rounded-md border border-border bg-muted/30">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="text-xs text-muted-foreground">
              PIX recebido direto na conta do lojista — sem intermediário.
              Confirme o recebimento ao visualizar o depósito no banco.
            </div>
            <div className="max-h-24 overflow-hidden break-all rounded-md border border-border bg-muted/40 p-2 font-mono text-[10px]">
              {ownPixPayload}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(ownPixPayload, "PIX copiado")}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar PIX
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!whatsappNumber}
                title={!whatsappNumber ? "Cliente sem WhatsApp cadastrado" : undefined}
                onClick={() => {
                  if (!whatsappNumber) return;
                  openWhatsApp(
                    whatsappNumber,
                    buildPixMessage({
                      customerName,
                      companyName,
                      amount,
                      pixPayload: ownPixPayload,
                    }),
                  );
                }}
              >
                <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                Compartilhar WhatsApp
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Após visualizar o pagamento no seu banco, clique em
              <strong> Confirmar pagamento</strong> para dar baixa no estoque
              e no financeiro.
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
