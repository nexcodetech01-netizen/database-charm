/**
 * Leitura do extrato em PDF do Nubank (conta PJ).
 *
 * Recebe as linhas do PDF já agrupadas (cada linha = lista de pedaços de
 * texto da esquerda para a direita, como o pdf.js entrega) e devolve os
 * movimentos. O layout do Nubank é:
 *
 *   26 SET 2026 | Total de entradas | + 179,80        ← dia + direção
 *   Transferência recebida pelo Pix | JOAO ... - | 179,80   ← movimento
 *   BCO BRADESCO S.A. ...                                   ← continuação
 *   Total de saídas | - 32,00                         ← muda a direção
 *   Saldo do dia | 851,24
 *
 * O dia e a direção continuam valendo na página seguinte.
 */

export type Direction = "in" | "out";

export interface StatementEntry {
  /** yyyy-mm-dd */
  date: string;
  direction: Direction;
  amount: number;
  /** "Transferência recebida pelo Pix", "Pagamento de fatura"… */
  kind: string;
  /** Nome de quem pagou / recebeu, quando houver */
  counterparty: string;
  /** Texto completo, para mostrar */
  description: string;
}

export interface ParsedStatement {
  bank: "nubank";
  periodStart: string | null;
  periodEnd: string | null;
  openingBalance: number | null;
  closingBalance: number | null;
  entries: StatementEntry[];
}

const MONTHS: Record<string, string> = {
  JAN: "01",
  FEV: "02",
  MAR: "03",
  ABR: "04",
  MAI: "05",
  JUN: "06",
  JUL: "07",
  AGO: "08",
  SET: "09",
  OUT: "10",
  NOV: "11",
  DEZ: "12",
  JANEIRO: "01",
  FEVEREIRO: "02",
  MARÇO: "03",
  MARCO: "03",
  ABRIL: "04",
  MAIO: "05",
  JUNHO: "06",
  JULHO: "07",
  AGOSTO: "08",
  SETEMBRO: "09",
  OUTUBRO: "10",
  NOVEMBRO: "11",
  DEZEMBRO: "12",
};

const MONEY = /^[+-]?\s*\d{1,3}(?:\.\d{3})*,\d{2}$/;
const DAY_HEADER = /^(\d{2}) ([A-ZÇ]{3}) (\d{4})$/;
const LONG_DATE = /^(\d{1,2}) DE ([A-ZÇ]+) DE (\d{4})$/i;

const NOT_ENTRY = [
  "saldo do dia",
  "saldo inicial",
  "saldo final do período",
  "saldo final do periodo",
  "total de entradas",
  "total de saídas",
  "total de saidas",
  "rendimento líquido",
  "rendimento liquido",
];

export function parseMoneyBR(text: string): number {
  const clean = text
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) ? Math.abs(n) : NaN;
}

function longDate(text: string): string | null {
  const m = LONG_DATE.exec(text.trim());
  if (!m) return null;
  const month = MONTHS[m[2].toUpperCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${m[1].padStart(2, "0")}`;
}

/** "JOAO VITOR MOTTA - •••.084.528-•• -" → "JOAO VITOR MOTTA" */
export function cleanCounterparty(text: string): string {
  let s = text.split(" - ")[0] ?? text;
  s = s.replace(/^\d{2}\.\d{3}\.\d{3}\s+/, ""); // CNPJ-prefixo de MEI
  s = s.replace(/\s+\d{11}$/, ""); // CPF colado no fim
  return s.replace(/\s+-\s*$/, "").trim();
}

export function parseNubankStatement(rows: string[][]): ParsedStatement {
  const out: ParsedStatement = {
    bank: "nubank",
    periodStart: null,
    periodEnd: null,
    openingBalance: null,
    closingBalance: null,
    entries: [],
  };
  let inMovements = false;
  let date: string | null = null;
  let direction: Direction | null = null;

  for (const raw of rows) {
    const cells = raw.map((c) => c.trim()).filter(Boolean);
    if (cells.length === 0) continue;
    const first = cells[0];
    const last = cells[cells.length - 1];
    const firstLower = first.toLowerCase();

    // Período: "25 DE SETEMBRO DE 2026 | a | 09 DE OUTUBRO DE 2026 | VALORES EM R$"
    if (!out.periodStart && cells.length >= 3 && longDate(cells[0]) && cells[1] === "a") {
      out.periodStart = longDate(cells[0]);
      out.periodEnd = longDate(cells[2]);
      continue;
    }
    if (firstLower === "saldo inicial" && MONEY.test(last) && out.openingBalance === null) {
      out.openingBalance = parseMoneyBR(last);
      continue;
    }
    if (firstLower.startsWith("saldo final do per") && cells.length >= 2 && MONEY.test(last)) {
      out.closingBalance = parseMoneyBR(last);
      continue;
    }
    if (firstLower === "movimentações" || firstLower === "movimentacoes") {
      inMovements = true;
      continue;
    }
    if (!inMovements) continue;

    let idx = 0;
    const day = DAY_HEADER.exec(first);
    if (day) {
      const month = MONTHS[day[2]];
      if (month) date = `${day[3]}-${month}-${day[1]}`;
      idx = 1;
    }
    const label = (cells[idx] ?? "").toLowerCase();
    if (label.startsWith("total de entradas")) {
      direction = "in";
      continue;
    }
    if (label.startsWith("total de sa")) {
      direction = "out";
      continue;
    }
    if (day) continue;

    // Movimento: termina com valor e não é linha de total/saldo
    if (
      cells.length >= 2 &&
      MONEY.test(last) &&
      !last.trim().startsWith("+") &&
      !NOT_ENTRY.some((p) => firstLower.startsWith(p)) &&
      date &&
      direction
    ) {
      const amount = parseMoneyBR(last);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const kind = first;
      const counterparty = cells.length >= 3 ? cleanCounterparty(cells.slice(1, -1).join(" ")) : "";
      out.entries.push({
        date,
        direction,
        amount,
        kind,
        counterparty,
        description: counterparty ? `${kind} · ${counterparty}` : kind,
      });
    }
  }
  return out;
}
