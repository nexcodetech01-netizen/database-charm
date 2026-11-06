import { escapeXml } from "@/features/printing/lib/barcode";

export interface VoucherData {
  companyName: string;
  customerName: string;
  /** Valor gerado nesta troca (0 = só reimpressão do saldo). */
  credit: number;
  /** Saldo total disponível da cliente. */
  balance: number;
  /** Ex.: "Troca da venda VD-20261029-0004". */
  origin?: string | null;
  date?: Date;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Cupom de vale-troca para impressora térmica (80 mm) ou A4. */
export function buildVoucherHtml(d: VoucherData): string {
  const date = (d.date ?? new Date()).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
  const credit =
    d.credit > 0
      ? `<div class="row"><span>Valor desta troca</span><b>${escapeXml(brl(d.credit))}</b></div>`
      : "";
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<title>Vale-troca</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  body { font-family: Arial, Helvetica, sans-serif; width: 72mm; margin: 0 auto; color: #000; }
  h1 { font-size: 15pt; text-align: center; margin: 2mm 0 1mm; }
  .store { text-align: center; font-size: 10pt; font-weight: bold; }
  .box { border: 1.5px dashed #000; border-radius: 3mm; padding: 3mm; margin: 3mm 0; }
  .who { font-size: 11pt; text-align: center; margin-bottom: 2mm; }
  .row { display: flex; justify-content: space-between; font-size: 10pt; margin: 1mm 0; }
  .total { font-size: 16pt; text-align: center; font-weight: bold; margin-top: 2mm; }
  .small { font-size: 8pt; text-align: center; margin-top: 2mm; }
</style></head><body>
  <div class="store">${escapeXml(d.companyName)}</div>
  <h1>VALE-TROCA</h1>
  <div class="box">
    <div class="who">${escapeXml(d.customerName)}</div>
    ${credit}
    <div class="row"><span>Saldo disponível</span></div>
    <div class="total">${escapeXml(brl(d.balance))}</div>
  </div>
  ${d.origin ? `<div class="small">${escapeXml(d.origin)}</div>` : ""}
  <div class="small">Emitido em ${escapeXml(date)}</div>
  <div class="small">Use na loja, informando o nome acima. O saldo que sobrar continua disponível.</div>
</body></html>`;
}
