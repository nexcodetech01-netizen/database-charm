// Máscaras e formatadores reutilizáveis (pt-BR).
// Todas as funções são puras e seguras para SSR.

export const MASKS = {
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  phone: "(00) 0000-0000",
  cell: "(00) 00000-0000",
  cep: "00000-000",
  date: "00/00/0000",
  time: "00:00",
} as const;

/** Remove tudo que não é dígito. */
export function digits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D+/g, "");
}

/** Aplica máscara CPF (000.000.000-00) tolerante a input parcial. */
export function maskCPF(v: string): string {
  const d = digits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Aplica máscara CNPJ (00.000.000/0000-00). */
export function maskCNPJ(v: string): string {
  const d = digits(v).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** CPF ou CNPJ conforme o comprimento. */
export function maskDocument(v: string): string {
  const d = digits(v);
  return d.length <= 11 ? maskCPF(d) : maskCNPJ(d);
}

/** Telefone brasileiro (10 ou 11 dígitos). */
export function maskPhone(v: string): string {
  const d = digits(v).slice(0, 11);
  if (d.length <= 10) {
    return d
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

/** CEP (00000-000). */
export function maskCEP(v: string): string {
  const d = digits(v).slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

/** Formata número como moeda BRL (sem símbolo). */
export function formatCurrencyInput(v: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

/**
 * Interpreta string livre pt-BR como número.
 * Aceita "1.234,56", "1234,56", "1234.56" e "1234".
 */
export function parseCurrency(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (!v) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  
  // Remove tudo exceto dígitos, vírgula, ponto e sinal.
  const cleaned = s.replace(/[^\d,.-]/g, "");
  
  // Se tem vírgula, tratamos como padrão pt-BR (ponto milhar, vírgula decimal)
  if (cleaned.includes(",")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
  }
  
  // Se tem apenas ponto(s), decidimos se é milhar ou decimal
  if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    // Se tem mais de um ponto, é certamente milhar
    if (parts.length > 2) {
      const n = Number(cleaned.replace(/\./g, ""));
      return Number.isFinite(n) ? n : 0;
    }
    // Se tem um ponto e o que vem depois tem 3 dígitos, tratamos como milhar no contexto brasileiro
    // (ex: 1.000 ou 4.000)
    if (parts[1].length === 3) {
      const n = Number(cleaned.replace(/\./g, ""));
      return Number.isFinite(n) ? n : 0;
    }
    // Caso contrário (ex: 10.50), é decimal
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Formata percentual (aceita string ou número). */
export function formatPercent(v: number, digits2 = 2): string {
  return `${v.toFixed(digits2).replace(".", ",")}%`;
}
