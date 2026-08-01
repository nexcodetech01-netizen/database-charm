/**
 * Bella Contadora — Auditoria (Sprint 7.2): contratos de leitura.
 *
 * NENHUMA regra de negócio nasce aqui. A auditoria apenas LÊ dados já
 * apurados pelos motores oficiais (Accounting, Finance, Sales, Inventory,
 * Cash, Fiscal/Tributário) e aponta inconsistências. Nada é corrigido,
 * gravado, recalculado ou estimado.
 */
import type { AccountingInsight } from "../insights";
import type { BellaNotification } from "../proactive";
import type { BellaTaxSnapshot } from "../tax/types";
import type { AccountingSummary } from "../types";
import type {
  AuditCashSessionRow,
  AuditCustomerRow,
  AuditFiscalDefaults,
  AuditFiscalDocumentRow,
  AuditProductRow,
  AuditSaleRow,
  AuditStagnantProductRow,
  AuditTransactionRow,
} from "../services/ports";

/** Severidade da inconsistência (define a ordenação padrão). */
export type AuditSeverity = "critical" | "high" | "medium" | "low";

/** Categorias oficiais da Sprint 7.2. */
export type AuditCategory =
  | "financeiro"
  | "caixa"
  | "estoque"
  | "comercial"
  | "cadastros"
  | "fiscal"
  | "tributario"
  | "contabil";

/** Destinos de navegação (apenas rotas existentes). */
export type AuditLinkId =
  | "abrir_financeiro"
  | "abrir_caixa"
  | "abrir_estoque"
  | "abrir_clientes"
  | "abrir_produtos"
  | "abrir_fiscal"
  | "abrir_tributario"
  | "abrir_relatorios";

export interface AuditLink {
  id: AuditLinkId;
  label: string;
  href: string;
}

/** Identificador estável de cada verificação. */
export type AuditRuleId =
  // Financeiro
  | "fin_contas_vencidas"
  | "fin_venda_paga_sem_lancamento"
  | "fin_recebimento_duplicado"
  | "fin_valor_negativo"
  | "fin_recebimento_inconsistente"
  // Caixa
  | "caixa_divergente"
  | "caixa_sessao_longa"
  | "caixa_saldo_incompativel"
  // Estoque
  | "estoque_negativo"
  | "estoque_produto_sem_custo"
  | "estoque_produto_sem_preco"
  | "estoque_abaixo_minimo"
  | "estoque_sem_movimentacao"
  // Comercial
  | "comercial_pf_sem_cpf"
  | "comercial_pj_sem_cnpj"
  | "comercial_sem_telefone"
  | "comercial_cliente_duplicado"
  // Cadastros
  | "cadastro_produto_sem_ncm"
  | "cadastro_sem_cst"
  | "cadastro_produto_sem_unidade"
  | "cadastro_produto_sem_categoria"
  | "cadastro_inativo_anunciado"
  // Fiscal
  | "fiscal_documento_rejeitado"
  | "fiscal_xml_pendente"
  | "fiscal_danfe_pendente"
  | "fiscal_teto_simples"
  // Tributário
  | "tributario_das_vencendo"
  | "tributario_das_atrasado"
  | "tributario_rbt12_mudanca_faixa"
  // Contábil
  | "contabil_prolabore_nao_registrado"
  | "contabil_distribuicao_acima_lucro"
  | "contabil_lucro_negativo"
  | "contabil_patrimonio_negativo";

/** Uma inconsistência encontrada (sempre com evidência real). */
export interface AuditFinding {
  id: AuditRuleId;
  category: AuditCategory;
  severity: AuditSeverity;
  title: string;
  description: string;
  recommendation: string;
  /** Quantidade de registros afetados. */
  count: number;
  /** Amostra legível dos registros (no máximo 5). */
  sample: string[];
  /** IDs dos registros afetados (auditoria/testes). */
  entityIds: string[];
  link: AuditLink;
}

/** Resultado de uma verificação — `ok: true` quando nada foi encontrado. */
export interface AuditCheckResult {
  id: AuditRuleId;
  category: AuditCategory;
  label: string;
  ok: boolean;
  finding: AuditFinding | null;
}

export interface AuditCategoryScore {
  category: AuditCategory;
  label: string;
  total: number;
  ok: number;
  findings: number;
  critical: number;
}

/** Saúde operacional consolidada. */
export interface AuditHealth {
  level: "critico" | "alto" | "medio" | "baixo" | "ok";
  label: string;
  /** 0–100 (100 = nenhuma inconsistência). */
  score: number;
}

/** Retrato de auditoria da empresa. */
export interface AuditSnapshot {
  generatedAt: string;
  /** Data operacional considerada (ISO). */
  today: string;
  findings: AuditFinding[];
  checks: AuditCheckResult[];
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    ok: number;
    total: number;
  };
  categories: AuditCategoryScore[];
  health: AuditHealth;
}

/** Dados brutos lidos dos motores oficiais (nunca modificados). */
export interface AuditDataset {
  today: string;
  transactions: AuditTransactionRow[];
  sales: AuditSaleRow[];
  cashSessions: AuditCashSessionRow[];
  products: AuditProductRow[];
  customers: AuditCustomerRow[];
  fiscalDocuments: AuditFiscalDocumentRow[];
  fiscalDefaults: AuditFiscalDefaults | null;
  stagnant: AuditStagnantProductRow[];
  /** Retrato tributário oficial (Sprint 7.1), quando disponível. */
  tax: BellaTaxSnapshot | null;
  /** Resumo contábil/financeiro já apurado, quando disponível. */
  summary: AccountingSummary | null;
  /** Patrimônio líquido apurado pelo motor contábil. */
  equity: number | null;
  /** Lucro líquido do período apurado pelo motor contábil. */
  netProfit: number | null;
}

/** Regra determinística de auditoria (pura). */
export interface AuditRule {
  id: AuditRuleId;
  category: AuditCategory;
  label: string;
  severity: AuditSeverity;
  run(dataset: AuditDataset): AuditFinding | null;
}

/** Métrica exibida no bloco "Saúde Operacional". */
export interface AuditMetric {
  id: string;
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}

/** View model do bloco de auditoria. */
export interface AuditView {
  available: boolean;
  note?: string;
  snapshot: AuditSnapshot | null;
  headline: string;
  metrics: AuditMetric[];
  findings: AuditFinding[];
  insights: AccountingInsight[];
  notifications: BellaNotification[];
  links: AuditLink[];
}
