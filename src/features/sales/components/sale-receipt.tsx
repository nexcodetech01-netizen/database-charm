import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { useCompanyBranding } from "@/features/settings/hooks/use-company-branding";
import { useReceiptPreferences } from "@/features/settings/hooks/use-receipt-preferences";
import { salesService } from "../services/sales.service";
import { paymentMethodLabel } from "../lib/whatsapp-receipt";

const DEFAULT_FAREWELL = ["Obrigado pela preferência!", "Volte sempre!"];


export type ReceiptWidth = "58mm" | "80mm";

interface Props {
  saleId: string;
  companyId: string;
  width?: ReceiptWidth;
  paymentMethod?: string | null;
  pixQrBase64?: string | null;
  pixPayload?: string | null;
  pixExpiration?: string | null;
  pixPaid?: boolean;
  operatorName?: string | null;
}

interface CompanyRow {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj: string | null;
  phone: string | null;
  address: string | null;
  receipt_footer: string | null;
}

function useCompany(companyId: string) {
  return useQuery({
    queryKey: ["company", "receipt", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as CompanyRow | null;
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

function useSale(saleId: string) {
  return useQuery({
    queryKey: ["sale", "receipt", saleId],
    queryFn: () => salesService.get(saleId),
    enabled: !!saleId,
  });
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("pt-BR");
}
function fmtTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function SaleReceipt({
  saleId,
  companyId,
  width = "80mm",
  paymentMethod,
  pixQrBase64,
  pixPayload,
  pixExpiration,
  pixPaid,
  operatorName,
}: Props) {
  const saleQ = useSale(saleId);
  const brandingQ = useCompanyBranding(companyId);
  const { prefs } = useReceiptPreferences(companyId);

  const sale = saleQ.data;
  const branding = brandingQ.data?.company ?? null;

  const method = paymentMethod ?? sale?.payment_method ?? null;
  const methodLabel = paymentMethodLabel(method);

  const farewell = useMemo(() => {
    const custom = prefs.farewell?.trim();
    if (!custom) return DEFAULT_FAREWELL;
    return custom.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  }, [prefs.farewell]);

  const addressLine = useMemo(() => {
    if (!branding) return null;
    const line1 = [branding.address, branding.address_number].filter(Boolean).join(", ");
    const complement = branding.complement ? ` - ${branding.complement}` : "";
    const line2 = [branding.neighborhood, [branding.city, branding.state].filter(Boolean).join("/")]
      .filter(Boolean)
      .join(" - ");
    const zip = branding.zip_code ? `CEP ${branding.zip_code}` : "";
    return [
      line1 ? `${line1}${complement}` : null,
      line2 || null,
      zip || null,
    ].filter(Boolean) as string[];
  }, [branding]);

  const instagramHandle = useMemo(() => {
    const site = branding?.website ?? "";
    const match = site.match(/instagram\.com\/([^\/?#]+)/i);
    return match ? `@${match[1]}` : null;
  }, [branding?.website]);

  if (saleQ.isLoading || brandingQ.isLoading) {
    return <div className="receipt-loading p-4 text-sm">Carregando cupom…</div>;
  }
  if (!sale) {
    return <div className="p-4 text-sm text-destructive">Venda não encontrada.</div>;
  }

  const showPix = method === "pix";

  return (
    <div className={`receipt receipt-${width === "58mm" ? "58" : "80"}`}>
      {/* Empresa */}
      <header className="receipt-header">
        <div className="receipt-title">
          {branding?.trade_name || branding?.name || "—"}
        </div>
        {branding?.name && branding.trade_name && branding.name !== branding.trade_name ? (
          <div className="receipt-sub">{branding.name}</div>
        ) : null}
        {branding?.cnpj ? <div className="receipt-sub">CNPJ: {branding.cnpj}</div> : null}
        {prefs.showPhone && branding?.phone ? (
          <div className="receipt-sub">Tel: {branding.phone}</div>
        ) : null}
        {prefs.showAddress && addressLine?.length
          ? addressLine.map((l) => <div key={l} className="receipt-sub">{l}</div>)
          : null}
      </header>



      <Divider />
      <div className="receipt-badge">CUPOM NÃO FISCAL</div>
      <Divider />

      {/* Meta */}
      <dl className="receipt-meta">
        <Row k="Venda Nº" v={sale.number ?? "—"} />
        <Row k="Data" v={fmtDate(sale.sale_date ?? sale.created_at)} />
        <Row k="Hora" v={fmtTime(sale.created_at)} />
        {prefs.showSeller && operatorName ? <Row k="Vendedor" v={operatorName} /> : null}
        {prefs.showCustomer && sale.customer_name ? (
          <Row k="Cliente" v={sale.customer_name} />
        ) : null}
      </dl>

      <Divider />

      {/* Itens */}
      <div className="receipt-section-title">ITENS</div>
      <ul className="receipt-items">
        {sale.items.map((it) => {
          const qty = Number(it.quantity ?? 0);
          const unit = Number(it.unit_price ?? 0);
          const total = Number(it.total ?? qty * unit);
          return (
            <li key={it.id} className="receipt-item">
              <div className="receipt-item-desc">{it.description}</div>
              <div className="receipt-item-line">
                <span>
                  {qty.toLocaleString("pt-BR")} × {formatCurrency(unit)}
                </span>
                <span className="receipt-item-total">{formatCurrency(total)}</span>
              </div>
            </li>
          );
        })}
      </ul>

      <Divider />

      {/* Totais */}
      <dl className="receipt-totals">
        <Row k="Subtotal" v={formatCurrency(Number(sale.items_total ?? 0))} />
        {Number(sale.discount ?? 0) > 0 ? (
          <Row k="Desconto" v={`- ${formatCurrency(Number(sale.discount))}`} />
        ) : null}
        {Number(sale.shipping ?? 0) > 0 ? (
          <Row k="Frete" v={formatCurrency(Number(sale.shipping))} />
        ) : null}
        <Row
          k="TOTAL"
          v={formatCurrency(Number(sale.grand_total ?? 0))}
          strong
        />
      </dl>

      <Divider />

      {/* Pagamento */}
      <div className="receipt-section-title">FORMA DE PAGAMENTO</div>
      <div className="receipt-payment">{methodLabel}</div>
      {method === "credit_card" ? (
        <CreditCardInstallmentLine saleId={saleId} fallbackTotal={Number(sale.grand_total ?? 0)} />
      ) : null}



      {showPix ? (
        pixPaid ? (
          <div className="receipt-pix-confirmed">PAGAMENTO CONFIRMADO</div>
        ) : (
          <div className="receipt-pix">
            {prefs.showQrCode && pixQrBase64 ? (
              <img
                src={`data:image/png;base64,${pixQrBase64}`}
                alt="QR Code PIX"
                className="receipt-pix-qr"
              />
            ) : null}
            {pixPayload ? (
              <div className="receipt-pix-payload">{pixPayload}</div>
            ) : null}
            {pixExpiration ? (
              <div className="receipt-pix-exp">Expira em: {pixExpiration}</div>
            ) : null}
          </div>
        )
      ) : null}

      <Divider />

      {/* Mensagem final */}
      <footer className="receipt-footer">
        {farewell.map((line) => (
          <div key={line}>{line}</div>
        ))}

        {(prefs.showWhatsapp && branding?.whatsapp) ||
        (prefs.showSocial && (branding?.website || instagramHandle)) ? (
          <div className="receipt-contacts" style={{ marginTop: 8 }}>
            {prefs.showWhatsapp && branding?.whatsapp ? (
              <div className="receipt-sub">WhatsApp: {branding.whatsapp}</div>
            ) : null}
            {prefs.showSocial && instagramHandle ? (
              <div className="receipt-sub">Instagram: {instagramHandle}</div>
            ) : null}
            {prefs.showSocial && branding?.website && !instagramHandle ? (
              <div className="receipt-sub">{branding.website}</div>
            ) : null}
          </div>
        ) : null}
      </footer>
    </div>
  );
}

function Divider() {
  return <div className="receipt-divider" aria-hidden="true" />;
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className={`receipt-row${strong ? " receipt-row-strong" : ""}`}>
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

/**
 * PDV-014 — Linha de parcelamento no cupom para cartão de crédito.
 * Lê da cobrança Bella Pay quando existe; caso contrário, exibe "à vista".
 */
function CreditCardInstallmentLine({
  saleId,
  fallbackTotal,
}: {
  saleId: string;
  fallbackTotal: number;
}) {
  const { data } = useQuery({
    queryKey: ["sale", "receipt", "installments", saleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bella_pay_charges")
        .select("installment_count, installment_value, value")
        .eq("sale_id", saleId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  const count = Number(data?.installment_count ?? 1);
  const value = Number(data?.installment_value ?? data?.value ?? fallbackTotal);
  if (count <= 1) {
    return <div className="receipt-payment-sub">1x de {formatCurrency(value)}</div>;
  }
  return (
    <div className="receipt-payment-sub">
      {count}x de {formatCurrency(value)}
    </div>
  );
}

