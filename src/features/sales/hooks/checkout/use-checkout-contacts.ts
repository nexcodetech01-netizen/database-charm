import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toWhatsAppNumber } from "../../lib/checkout-messages";
import { generatePixBRCode } from "../../lib/pix-brcode";

interface CheckoutCompany {
  name: string | null;
  pix_key: string | null;
  pix_key_type: string | null;
  pix_recipient_name: string | null;
  pix_recipient_city: string | null;
}

/**
 * Cliente (nome/WhatsApp) e empresa (nome + dados do PIX próprio) usados
 * nas mensagens de compartilhamento e na geração do BR Code.
 */
export function useCheckoutContacts(params: {
  open: boolean;
  customerId: string | null;
  companyId: string;
}) {
  const { open, customerId, companyId } = params;

  const customerQuery = useQuery({
    queryKey: ["checkout-customer", customerId],
    enabled: open && !!customerId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase
        .from("customers")
        .select("name,phone,whatsapp")
        .eq("id", customerId)
        .maybeSingle();
      if (error) throw error;
      return data as { name: string | null; phone: string | null; whatsapp: string | null } | null;
    },
  });

  const companyQuery = useQuery({
    queryKey: ["checkout-company", companyId],
    enabled: open && !!companyId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("name,pix_key,pix_key_type,pix_recipient_name,pix_recipient_city")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data as CheckoutCompany | null;
    },
  });

  const customer = customerQuery.data;
  return {
    customerName: customer?.name ?? null,
    whatsappNumber: toWhatsAppNumber(customer?.whatsapp ?? customer?.phone ?? null),
    company: companyQuery.data ?? null,
    companyName: companyQuery.data?.name ?? null,
  };
}

/**
 * PIX próprio: payload BR Code (copia e cola) a partir da chave do lojista
 * e o QR Code correspondente. A biblioteca `qrcode` só é baixada quando o
 * PIX próprio é de fato exibido.
 */
export function useOwnPix(params: {
  enabled: boolean;
  company: CheckoutCompany | null;
  amount: number;
  saleNumber?: string | null;
}) {
  const { enabled, company, amount, saleNumber } = params;

  const payload = useMemo(() => {
    if (!enabled) return null;
    const key = company?.pix_key?.trim();
    if (!key) return null;
    try {
      return generatePixBRCode({
        pixKey: key,
        recipientName: company?.pix_recipient_name ?? company?.name ?? "RECEBEDOR",
        recipientCity: company?.pix_recipient_city ?? "BRASIL",
        amount,
        txid: saleNumber?.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || undefined,
        description: saleNumber ? `Venda ${saleNumber}` : undefined,
      });
    } catch {
      return null;
    }
  }, [enabled, company, amount, saleNumber]);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!payload) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(payload, { margin: 1, width: 256, errorCorrectionLevel: "M" }),
      )
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  return { payload, qrDataUrl };
}
