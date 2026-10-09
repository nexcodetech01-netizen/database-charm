import { formatCurrency } from "@/lib/format";

export type AuditAction = "insert" | "update" | "delete";

export interface AuditEntry {
  id: number;
  company_id: string;
  table_name: string;
  record_id: string | null;
  parent_table: string | null;
  parent_id: string | null;
  action: AuditAction;
  actor_id: string | null;
  actor_name: string | null;
  via: string;
  label: string | null;
  changes: Record<string, unknown>;
  created_at: string;
}

/** Áreas do filtro e as tabelas de cada uma. */
export const AUDIT_AREAS = {
  financeiro: {
    label: "Financeiro",
    tables: [
      "financial_transactions",
      "financial_accounts",
      "financial_transfers",
      "credit_accounts",
      "credit_installments",
      "credit_payments",
    ],
  },
  caixa: { label: "Caixa", tables: ["cash_sessions", "cash_movements"] },
  vendas: { label: "Vendas", tables: ["sales", "sale_items"] },
  compras: { label: "Compras", tables: ["purchases", "purchase_items"] },
  estoque: { label: "Estoque e produtos", tables: ["products", "inventory_movements"] },
} as const;
export type AuditArea = keyof typeof AUDIT_AREAS;

const TABLE_LABEL: Record<string, string> = {
  financial_transactions: "Lançamento",
  financial_accounts: "Conta",
  financial_transfers: "Transferência",
  credit_accounts: "Crediário",
  credit_installments: "Parcela do crediário",
  credit_payments: "Pagamento de crediário",
  cash_sessions: "Caixa",
  cash_movements: "Movimento de caixa",
  sales: "Venda",
  sale_items: "Item da venda",
  purchases: "Compra",
  purchase_items: "Item da compra",
  products: "Produto",
  inventory_movements: "Movimento de estoque",
};

const ACTION_LABEL: Record<AuditAction, string> = {
  insert: "criou",
  update: "alterou",
  delete: "excluiu",
};

const FIELD_LABEL: Record<string, string> = {
  amount: "Valor",
  description: "Descrição",
  status: "Situação",
  type: "Tipo",
  due_date: "Vencimento",
  transaction_date: "Data",
  paid_at: "Pago em",
  payment_method: "Forma de pagamento",
  account_id: "Conta",
  category_id: "Categoria",
  discount_amount: "Desconto na baixa",
  notes: "Observações",
  source: "Origem",
  current_balance: "Saldo",
  initial_balance: "Saldo inicial",
  name: "Nome",
  balance: "Saldo devedor",
  paid_amount: "Valor pago",
  grand_total: "Total",
  items_total: "Total dos itens",
  discount: "Desconto",
  shipping: "Frete",
  deleted_at: "Excluída em",
  customer_id: "Cliente",
  sale_date: "Data da venda",
  quantity: "Quantidade",
  unit_price: "Preço unitário",
  total: "Total",
  price: "Preço",
  cost: "Custo",
  stock: "Estoque",
  min_stock: "Estoque mínimo",
  sku: "SKU",
  reason: "Motivo",
  counted_cash: "Dinheiro contado",
  difference: "Diferença",
  opening_balance: "Abertura",
  received_at: "Recebida em",
  supplier_id: "Fornecedor",
};

/** Campos que não ajudam quem lê (ids técnicos, carimbos). */
const HIDDEN_FIELDS = new Set([
  "id",
  "company_id",
  "created_by",
  "updated_at",
  "created_at",
  "reference_id",
  "finance_ref",
  "settlement_session_id",
  "bella_pay_charge_id",
  "asaas_charge_id",
  "recurring_parent_id",
  "cost_center_id",
  "client_request_id",
  "cash_session_id",
  "sale_id",
  "purchase_id",
  "product_id",
  "credit_account_id",
  "installment_id",
  "financial_transaction_id",
  "session_id",
  "transaction_id",
  "user_id",
  "operator_id",
  "stock_applied",
  "stock_reversed",
  "position",
  "is_recurring",
  "is_test",
]);

const MONEY_FIELDS = new Set([
  "amount",
  "discount_amount",
  "current_balance",
  "initial_balance",
  "balance",
  "paid_amount",
  "grand_total",
  "items_total",
  "discount",
  "shipping",
  "unit_price",
  "total",
  "price",
  "cost",
  "counted_cash",
  "difference",
  "opening_balance",
  "original_amount",
  "down_payment",
  "unit_cost",
  "total_cost",
  "expected_cash",
  "freight",
  "other_costs",
  "insurance",
]);

const VALUE_LABEL: Record<string, string> = {
  pending: "pendente",
  overdue: "vencido",
  partial: "parcial",
  partially_paid: "parcialmente pago",
  paid: "pago",
  cancelled: "cancelado",
  refunded: "estornado",
  draft: "rascunho",
  open: "aberto",
  closed: "fechado",
  settled: "quitado",
  received: "recebida",
  income: "entrada",
  expense: "saída",
  in: "entrada",
  out: "saída",
  cash: "dinheiro",
  pix: "Pix",
  pix_manual: "Pix",
  credit_card: "cartão de crédito",
  debit_card: "cartão de débito",
  credit: "crediário",
  active: "ativo",
  inactive: "inativo",
};

export const VIA_LABEL: Record<string, string> = {
  app: "pelo app",
  servidor: "pelo servidor (Bella, WhatsApp ou automação)",
  banco: "direto no banco (SQL)",
};

export function tableLabel(table: string): string {
  return TABLE_LABEL[table] ?? table;
}

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field.replace(/_/g, " ");
}

export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (MONEY_FIELDS.has(field)) {
    const n = Number(value);
    return Number.isFinite(n) ? formatCurrency(n) : String(value);
  }
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-");
      return `${d}/${m}/${y}`;
    }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(value)) return "(registro vinculado)";
    return VALUE_LABEL[value] ?? value;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export interface AuditChangeLine {
  field: string;
  label: string;
  before?: string;
  after: string;
}

/** Linhas legíveis do que mudou (ou do que foi criado/excluído). */
export function describeChanges(entry: Pick<AuditEntry, "action" | "changes">): AuditChangeLine[] {
  const lines: AuditChangeLine[] = [];
  for (const [field, raw] of Object.entries(entry.changes ?? {})) {
    if (HIDDEN_FIELDS.has(field)) continue;
    if (entry.action === "update") {
      const diff = raw as { old?: unknown; new?: unknown } | null;
      lines.push({
        field,
        label: fieldLabel(field),
        before: formatAuditValue(field, diff?.old),
        after: formatAuditValue(field, diff?.new),
      });
    } else {
      lines.push({ field, label: fieldLabel(field), after: formatAuditValue(field, raw) });
    }
  }
  // Campos mais importantes primeiro
  const order = [
    "status",
    "amount",
    "grand_total",
    "price",
    "cost",
    "stock",
    "quantity",
    "account_id",
    "payment_method",
    "due_date",
    "paid_at",
    "description",
    "name",
  ];
  return lines.sort((a, b) => {
    const ia = order.indexOf(a.field);
    const ib = order.indexOf(b.field);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

/** Frase curta: "Gabriela alterou Lançamento “shoope”". */
export function describeEntry(
  entry: Pick<AuditEntry, "action" | "table_name" | "label" | "actor_name" | "via">,
): string {
  const who =
    entry.actor_name ??
    (entry.via === "servidor"
      ? "Sistema (Bella/WhatsApp/automação)"
      : entry.via === "banco"
        ? "Ajuste direto no banco"
        : "Sistema");
  const what = tableLabel(entry.table_name);
  const label = entry.label ? ` “${entry.label}”` : "";
  return `${who} ${ACTION_LABEL[entry.action] ?? entry.action} ${what.toLowerCase()}${label}`;
}
