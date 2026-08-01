/**
 * Bella Contadora — Auditoria (Sprint 7.2): regras determinísticas.
 *
 * Camada 100% pura: recebe o `AuditDataset` já lido dos motores oficiais e
 * devolve inconsistências. Nenhuma regra de negócio nova, nenhum cálculo
 * fiscal/tributário/contábil: apenas comparações sobre dados apurados.
 */
import { formatCurrency } from "@/lib/format";
import { BELLA_AUDIT_LINKS } from "./links";
import type {
  AuditCategory,
  AuditDataset,
  AuditFinding,
  AuditLinkId,
  AuditRule,
  AuditRuleId,
  AuditSeverity,
} from "./types";

const SAMPLE_LIMIT = 5;

interface FindingInput {
  id: AuditRuleId;
  category: AuditCategory;
  severity: AuditSeverity;
  title: string;
  description: string;
  recommendation: string;
  link: AuditLinkId;
  items: { id: string; label: string }[];
}

function finding(input: FindingInput): AuditFinding | null {
  if (input.items.length === 0) return null;
  return {
    id: input.id,
    category: input.category,
    severity: input.severity,
    title: input.title,
    description: input.description,
    recommendation: input.recommendation,
    count: input.items.length,
    sample: input.items.slice(0, SAMPLE_LIMIT).map((i) => i.label),
    entityIds: input.items.map((i) => i.id),
    link: BELLA_AUDIT_LINKS[input.link],
  };
}

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

function normalizeName(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(fromISO);
  const b = Date.parse(toISO);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

const isPaid = (status: string) => status === "paid" || status === "received";
const isPending = (status: string) => status === "pending" || status === "overdue";

/* ─────────────────────────── FINANCEIRO ─────────────────────────── */

const contasVencidas: AuditRule = {
  id: "fin_contas_vencidas",
  category: "financeiro",
  label: "Contas vencidas",
  severity: "high",
  run: (d) =>
    finding({
      id: "fin_contas_vencidas",
      category: "financeiro",
      severity: "high",
      title: "Contas vencidas em aberto",
      description: "Lançamentos pendentes com vencimento anterior à data de hoje.",
      recommendation: "Renegocie, baixe ou cobre os títulos vencidos no Financeiro.",
      link: "abrir_financeiro",
      items: d.transactions
        .filter((t) => isPending(t.status) && !!t.dueDate && t.dueDate < d.today)
        .map((t) => ({
          id: t.id,
          label: `${t.description || "Lançamento"} — ${formatCurrency(t.amount)} (venc. ${t.dueDate})`,
        })),
    }),
};

const vendaSemLancamento: AuditRule = {
  id: "fin_venda_paga_sem_lancamento",
  category: "financeiro",
  label: "Vendas pagas sem lançamento financeiro",
  severity: "critical",
  run: (d) => {
    const referenced = new Set(
      d.transactions.map((t) => t.referenceId).filter((v): v is string => !!v),
    );
    return finding({
      id: "fin_venda_paga_sem_lancamento",
      category: "financeiro",
      severity: "critical",
      title: "Vendas pagas sem lançamento financeiro",
      description: "Vendas marcadas como pagas que não possuem lançamento correspondente.",
      recommendation: "Verifique a liquidação dessas vendas no módulo Financeiro.",
      link: "abrir_financeiro",
      items: d.sales
        .filter(
          (s) =>
            (s.status === "paid" || !!s.paidAt) &&
            !s.settledAt &&
            !referenced.has(s.id),
        )
        .map((s) => ({
          id: s.id,
          label: `Venda ${s.number ?? s.id.slice(0, 8)} — ${formatCurrency(s.total)}`,
        })),
    });
  },
};

const recebimentoDuplicado: AuditRule = {
  id: "fin_recebimento_duplicado",
  category: "financeiro",
  label: "Recebimentos duplicados",
  severity: "critical",
  run: (d) => {
    const groups = new Map<string, string[]>();
    for (const t of d.transactions) {
      if (t.type !== "income" || !isPaid(t.status) || !t.referenceId) continue;
      const key = `${t.referenceId}|${t.amount.toFixed(2)}`;
      groups.set(key, [...(groups.get(key) ?? []), t.id]);
    }
    const items: { id: string; label: string }[] = [];
    for (const [key, ids] of groups) {
      if (ids.length < 2) continue;
      const [reference] = key.split("|");
      ids.slice(1).forEach((id) =>
        items.push({ id, label: `Recebimento repetido da referência ${reference}` }),
      );
    }
    return finding({
      id: "fin_recebimento_duplicado",
      category: "financeiro",
      severity: "critical",
      title: "Recebimentos duplicados",
      description: "Mais de um recebimento pago para a mesma origem e o mesmo valor.",
      recommendation: "Confira as baixas duplicadas antes de fechar o período.",
      link: "abrir_financeiro",
      items,
    });
  },
};

const valorNegativo: AuditRule = {
  id: "fin_valor_negativo",
  category: "financeiro",
  label: "Lançamentos com valor negativo",
  severity: "high",
  run: (d) =>
    finding({
      id: "fin_valor_negativo",
      category: "financeiro",
      severity: "high",
      title: "Lançamentos com valor negativo",
      description: "Valores negativos distorcem o DRE e o fluxo de caixa.",
      recommendation: "Revise esses lançamentos e use o tipo correto (entrada/saída).",
      link: "abrir_financeiro",
      items: d.transactions
        .filter((t) => t.amount < 0)
        .map((t) => ({
          id: t.id,
          label: `${t.description || "Lançamento"} — ${formatCurrency(t.amount)}`,
        })),
    }),
};

const recebimentoInconsistente: AuditRule = {
  id: "fin_recebimento_inconsistente",
  category: "financeiro",
  label: "Recebimentos inconsistentes",
  severity: "medium",
  run: (d) =>
    finding({
      id: "fin_recebimento_inconsistente",
      category: "financeiro",
      severity: "medium",
      title: "Recebimentos sem data de baixa",
      description: "Lançamentos marcados como pagos, mas sem data de pagamento registrada.",
      recommendation: "Complete a data de liquidação para manter a conciliação correta.",
      link: "abrir_financeiro",
      items: d.transactions
        .filter((t) => isPaid(t.status) && !t.paidAt)
        .map((t) => ({
          id: t.id,
          label: `${t.description || "Lançamento"} — ${formatCurrency(t.amount)}`,
        })),
    }),
};

/* ───────────────────────────── CAIXA ───────────────────────────── */

const caixaDivergente: AuditRule = {
  id: "caixa_divergente",
  category: "caixa",
  label: "Caixa divergente",
  severity: "high",
  run: (d) =>
    finding({
      id: "caixa_divergente",
      category: "caixa",
      severity: "high",
      title: "Fechamentos de caixa com diferença",
      description: "Sessões fechadas com diferença entre o valor contado e o esperado.",
      recommendation: "Reveja as sangrias, suprimentos e recebimentos dessas sessões.",
      link: "abrir_caixa",
      items: d.cashSessions
        .filter((s) => s.status === "closed" && Math.abs(s.difference ?? 0) > 0.01)
        .map((s) => ({
          id: s.id,
          label: `Sessão ${s.id.slice(0, 8)} — diferença ${formatCurrency(s.difference ?? 0)}`,
        })),
    }),
};

const caixaSessaoLonga: AuditRule = {
  id: "caixa_sessao_longa",
  category: "caixa",
  label: "Sessão de caixa aberta há muito tempo",
  severity: "medium",
  run: (d) =>
    finding({
      id: "caixa_sessao_longa",
      category: "caixa",
      severity: "medium",
      title: "Caixa aberto há mais de 24 horas",
      description: "Sessões de caixa abertas por muito tempo comprometem a conferência diária.",
      recommendation: "Feche o caixa do dia para consolidar os recebimentos.",
      link: "abrir_caixa",
      items: d.cashSessions
        .filter(
          (s) => s.status === "open" && !!s.openedAt && daysBetween(s.openedAt, d.today) >= 1,
        )
        .map((s) => ({
          id: s.id,
          label: `Sessão ${s.id.slice(0, 8)} aberta desde ${String(s.openedAt).slice(0, 10)}`,
        })),
    }),
};

const caixaSaldoIncompativel: AuditRule = {
  id: "caixa_saldo_incompativel",
  category: "caixa",
  label: "Saldo de caixa incompatível",
  severity: "high",
  run: (d) =>
    finding({
      id: "caixa_saldo_incompativel",
      category: "caixa",
      severity: "high",
      title: "Saldo de caixa incompatível com a diferença registrada",
      description: "Contado menos esperado não corresponde à diferença gravada na sessão.",
      recommendation: "Revise o fechamento dessas sessões com o operador responsável.",
      link: "abrir_caixa",
      items: d.cashSessions
        .filter((s) => {
          if (s.status !== "closed") return false;
          if (s.countedCash == null || s.expectedCash == null) return false;
          const expectedDiff = s.countedCash - s.expectedCash;
          return Math.abs(expectedDiff - (s.difference ?? 0)) > 0.01;
        })
        .map((s) => ({
          id: s.id,
          label: `Sessão ${s.id.slice(0, 8)} — contado ${formatCurrency(s.countedCash ?? 0)} · esperado ${formatCurrency(s.expectedCash ?? 0)}`,
        })),
    }),
};

/* ──────────────────────────── ESTOQUE ──────────────────────────── */

const estoqueNegativo: AuditRule = {
  id: "estoque_negativo",
  category: "estoque",
  label: "Estoque negativo",
  severity: "critical",
  run: (d) =>
    finding({
      id: "estoque_negativo",
      category: "estoque",
      severity: "critical",
      title: "Produtos com estoque negativo",
      description: "Saldo negativo indica venda sem entrada ou movimentação faltante.",
      recommendation: "Confira as entradas e os ajustes desses produtos no Estoque.",
      link: "abrir_estoque",
      items: d.products
        .filter((p) => p.stock < 0)
        .map((p) => ({ id: p.id, label: `${p.name} — saldo ${p.stock}` })),
    }),
};

const produtoSemCusto: AuditRule = {
  id: "estoque_produto_sem_custo",
  category: "estoque",
  label: "Produto sem custo",
  severity: "high",
  run: (d) =>
    finding({
      id: "estoque_produto_sem_custo",
      category: "estoque",
      severity: "high",
      title: "Produtos sem custo cadastrado",
      description: "Sem custo, a margem e o CMV do período ficam incorretos.",
      recommendation: "Informe o custo de compra desses produtos.",
      link: "abrir_produtos",
      items: d.products
        .filter((p) => p.cost == null || p.cost <= 0)
        .map((p) => ({ id: p.id, label: `${p.name}${p.sku ? ` (${p.sku})` : ""}` })),
    }),
};

const produtoSemPreco: AuditRule = {
  id: "estoque_produto_sem_preco",
  category: "estoque",
  label: "Produto sem preço",
  severity: "high",
  run: (d) =>
    finding({
      id: "estoque_produto_sem_preco",
      category: "estoque",
      severity: "high",
      title: "Produtos sem preço de venda",
      description: "Produtos sem preço não podem ser vendidos corretamente no PDV.",
      recommendation: "Defina o preço de venda ou use a Inteligência de Precificação.",
      link: "abrir_produtos",
      items: d.products
        .filter((p) => p.price == null || p.price <= 0)
        .map((p) => ({ id: p.id, label: `${p.name}${p.sku ? ` (${p.sku})` : ""}` })),
    }),
};

const abaixoDoMinimo: AuditRule = {
  id: "estoque_abaixo_minimo",
  category: "estoque",
  label: "Estoque abaixo do mínimo",
  severity: "medium",
  run: (d) =>
    finding({
      id: "estoque_abaixo_minimo",
      category: "estoque",
      severity: "medium",
      title: "Produtos abaixo do estoque mínimo",
      description: "Saldo igual ou inferior ao mínimo definido no cadastro.",
      recommendation: "Programe a reposição desses itens em Compras.",
      link: "abrir_estoque",
      items: d.products
        .filter((p) => p.minStock > 0 && p.stock <= p.minStock)
        .map((p) => ({ id: p.id, label: `${p.name} — ${p.stock}/${p.minStock}` })),
    }),
};

const semMovimentacao: AuditRule = {
  id: "estoque_sem_movimentacao",
  category: "estoque",
  label: "Produto sem movimentação",
  severity: "low",
  run: (d) =>
    finding({
      id: "estoque_sem_movimentacao",
      category: "estoque",
      severity: "low",
      title: "Produtos sem movimentação",
      description: "Itens parados imobilizam capital de giro.",
      recommendation: "Avalie promoção, remarcação ou descontinuação desses itens.",
      link: "abrir_estoque",
      items: d.stagnant.map((p) => ({
        id: p.id,
        label: `${p.name}${p.sku ? ` (${p.sku})` : ""} — ${p.stock} em estoque`,
      })),
    }),
};

/* ─────────────────────────── COMERCIAL ─────────────────────────── */

const pfSemCpf: AuditRule = {
  id: "comercial_pf_sem_cpf",
  category: "comercial",
  label: "Cliente PF sem CPF",
  severity: "medium",
  run: (d) =>
    finding({
      id: "comercial_pf_sem_cpf",
      category: "comercial",
      severity: "medium",
      title: "Clientes sem CPF",
      description: "Clientes pessoa física sem documento válido (11 dígitos).",
      recommendation: "Complete o CPF para permitir emissão fiscal nominal.",
      link: "abrir_clientes",
      items: d.customers
        .filter((c) => {
          const doc = digits(c.document);
          return doc.length === 0 || (doc.length !== 11 && doc.length !== 14);
        })
        .map((c) => ({ id: c.id, label: c.name })),
    }),
};

const pjSemCnpj: AuditRule = {
  id: "comercial_pj_sem_cnpj",
  category: "comercial",
  label: "Cliente PJ sem CNPJ",
  severity: "medium",
  run: (d) =>
    finding({
      id: "comercial_pj_sem_cnpj",
      category: "comercial",
      severity: "medium",
      title: "Clientes PJ com CNPJ incompleto",
      description: "Documento com mais de 11 dígitos que não forma um CNPJ válido.",
      recommendation: "Corrija o CNPJ desses clientes no cadastro.",
      link: "abrir_clientes",
      items: d.customers
        .filter((c) => {
          const doc = digits(c.document);
          return doc.length > 11 && doc.length !== 14;
        })
        .map((c) => ({ id: c.id, label: `${c.name} — ${c.document}` })),
    }),
};

const semTelefone: AuditRule = {
  id: "comercial_sem_telefone",
  category: "comercial",
  label: "Cliente sem telefone",
  severity: "low",
  run: (d) =>
    finding({
      id: "comercial_sem_telefone",
      category: "comercial",
      severity: "low",
      title: "Clientes sem telefone ou WhatsApp",
      description: "Sem contato não é possível cobrar nem reativar o cliente.",
      recommendation: "Complete telefone ou WhatsApp na ficha do cliente.",
      link: "abrir_clientes",
      items: d.customers
        .filter((c) => !digits(c.phone) && !digits(c.whatsapp))
        .map((c) => ({ id: c.id, label: c.name })),
    }),
};

const clienteDuplicado: AuditRule = {
  id: "comercial_cliente_duplicado",
  category: "comercial",
  label: "Cliente duplicado",
  severity: "medium",
  run: (d) => {
    const byKey = new Map<string, { id: string; label: string }[]>();
    for (const c of d.customers) {
      const doc = digits(c.document);
      const key = doc.length >= 11 ? `doc:${doc}` : `name:${normalizeName(c.name)}`;
      if (key === "name:") continue;
      byKey.set(key, [...(byKey.get(key) ?? []), { id: c.id, label: c.name }]);
    }
    const items: { id: string; label: string }[] = [];
    for (const group of byKey.values()) {
      if (group.length < 2) continue;
      group.slice(1).forEach((c) => items.push({ id: c.id, label: `${c.label} (duplicado)` }));
    }
    return finding({
      id: "comercial_cliente_duplicado",
      category: "comercial",
      severity: "medium",
      title: "Clientes possivelmente duplicados",
      description: "Mesmo documento ou mesmo nome cadastrados mais de uma vez.",
      recommendation: "Unifique os cadastros para manter o histórico correto.",
      link: "abrir_clientes",
      items,
    });
  },
};

/* ─────────────────────────── CADASTROS ─────────────────────────── */

const semNcm: AuditRule = {
  id: "cadastro_produto_sem_ncm",
  category: "cadastros",
  label: "Produto sem NCM",
  severity: "high",
  run: (d) =>
    finding({
      id: "cadastro_produto_sem_ncm",
      category: "cadastros",
      severity: "high",
      title: "Produtos sem NCM",
      description: "Sem NCM a emissão de NF-e/NFC-e é rejeitada pela SEFAZ.",
      recommendation: "Informe o NCM desses produtos antes de emitir documentos.",
      link: "abrir_produtos",
      items: d.products
        .filter((p) => !(p.ncm ?? "").trim())
        .map((p) => ({ id: p.id, label: `${p.name}${p.sku ? ` (${p.sku})` : ""}` })),
    }),
};

const semCst: AuditRule = {
  id: "cadastro_sem_cst",
  category: "cadastros",
  label: "CST/CSOSN padrão ausente",
  severity: "high",
  run: (d) => {
    const missing = d.fiscalDefaults !== null && !(d.fiscalDefaults.defaultCst ?? "").trim();
    return finding({
      id: "cadastro_sem_cst",
      category: "cadastros",
      severity: "high",
      title: "CST/CSOSN padrão não configurado",
      description: "Sem CST/CSOSN padrão, os itens saem sem situação tributária.",
      recommendation: "Defina o CST/CSOSN padrão em Fiscal › Configuração.",
      link: "abrir_fiscal",
      items: missing ? [{ id: "fiscal_settings", label: "Configuração fiscal da empresa" }] : [],
    });
  },
};

const semUnidade: AuditRule = {
  id: "cadastro_produto_sem_unidade",
  category: "cadastros",
  label: "Produto sem unidade",
  severity: "medium",
  run: (d) =>
    finding({
      id: "cadastro_produto_sem_unidade",
      category: "cadastros",
      severity: "medium",
      title: "Produtos sem unidade de medida",
      description: "A unidade é obrigatória para venda e emissão fiscal.",
      recommendation: "Defina a unidade (un, kg, cx…) no cadastro do produto.",
      link: "abrir_produtos",
      items: d.products
        .filter((p) => !(p.unit ?? "").trim())
        .map((p) => ({ id: p.id, label: p.name })),
    }),
};

const semCategoria: AuditRule = {
  id: "cadastro_produto_sem_categoria",
  category: "cadastros",
  label: "Produto sem categoria",
  severity: "low",
  run: (d) =>
    finding({
      id: "cadastro_produto_sem_categoria",
      category: "cadastros",
      severity: "low",
      title: "Produtos sem categoria",
      description: "Sem categoria os relatórios e as políticas de preço ficam incompletos.",
      recommendation: "Classifique esses produtos em uma categoria existente.",
      link: "abrir_produtos",
      items: d.products
        .filter((p) => !p.categoryId)
        .map((p) => ({ id: p.id, label: p.name })),
    }),
};

const inativoAnunciado: AuditRule = {
  id: "cadastro_inativo_anunciado",
  category: "cadastros",
  label: "Produto inativo ainda anunciado",
  severity: "high",
  run: (d) =>
    finding({
      id: "cadastro_inativo_anunciado",
      category: "cadastros",
      severity: "high",
      title: "Produtos inativos ainda anunciados",
      description: "Itens inativos com anúncio ativo em marketplace geram venda sem estoque.",
      recommendation: "Encerre o anúncio ou reative o produto.",
      link: "abrir_produtos",
      items: d.products
        .filter((p) => p.status !== "active" && !!p.marketplaceId)
        .map((p) => ({ id: p.id, label: `${p.name} — anúncio ${p.marketplaceId}` })),
    }),
};

/* ──────────────────────────── FISCAL ──────────────────────────── */

const documentoRejeitado: AuditRule = {
  id: "fiscal_documento_rejeitado",
  category: "fiscal",
  label: "Documento fiscal rejeitado",
  severity: "critical",
  run: (d) =>
    finding({
      id: "fiscal_documento_rejeitado",
      category: "fiscal",
      severity: "critical",
      title: "Documentos fiscais rejeitados",
      description: "Notas rejeitadas pela SEFAZ que continuam sem reemissão.",
      recommendation: "Corrija o motivo da rejeição e reemita o documento.",
      link: "abrir_fiscal",
      items: d.fiscalDocuments
        .filter((doc) => doc.status === "rejected")
        .map((doc) => ({
          id: doc.id,
          label: `Nota ${doc.number ?? doc.id.slice(0, 8)} — ${doc.rejectionReason ?? "rejeitada"}`,
        })),
    }),
};

const xmlPendente: AuditRule = {
  id: "fiscal_xml_pendente",
  category: "fiscal",
  label: "XML pendente",
  severity: "medium",
  run: (d) =>
    finding({
      id: "fiscal_xml_pendente",
      category: "fiscal",
      severity: "medium",
      title: "XML autorizado pendente de download",
      description: "Documentos autorizados sem XML armazenado no cofre fiscal.",
      recommendation: "Reprocesse os artefatos fiscais desses documentos.",
      link: "abrir_fiscal",
      items: d.fiscalDocuments
        .filter((doc) => doc.status === "authorized" && !doc.xmlAuthorizedPath)
        .map((doc) => ({ id: doc.id, label: `Nota ${doc.number ?? doc.id.slice(0, 8)}` })),
    }),
};

const danfePendente: AuditRule = {
  id: "fiscal_danfe_pendente",
  category: "fiscal",
  label: "DANFE pendente",
  severity: "low",
  run: (d) =>
    finding({
      id: "fiscal_danfe_pendente",
      category: "fiscal",
      severity: "low",
      title: "DANFE pendente de download",
      description: "Documentos autorizados sem DANFE/DANFCE armazenado.",
      recommendation: "Reprocesse os artefatos para disponibilizar a impressão.",
      link: "abrir_fiscal",
      items: d.fiscalDocuments
        .filter((doc) => doc.status === "authorized" && !doc.danfePath)
        .map((doc) => ({ id: doc.id, label: `Nota ${doc.number ?? doc.id.slice(0, 8)}` })),
    }),
};

const tetoSimples: AuditRule = {
  id: "fiscal_teto_simples",
  category: "fiscal",
  label: "Proximidade do teto do Simples",
  severity: "high",
  run: (d) => {
    const tax = d.tax;
    const near = !!tax && tax.limitUsagePct >= 80;
    return finding({
      id: "fiscal_teto_simples",
      category: "fiscal",
      severity: "high",
      title: "Empresa próxima do teto do Simples Nacional",
      description: near
        ? `RBT12 já consome ${tax!.limitUsagePct.toFixed(1)}% do teto anual.`
        : "",
      recommendation: "Acompanhe o faturamento e planeje o enquadramento com o contador.",
      link: "abrir_tributario",
      items: near ? [{ id: "rbt12", label: `RBT12 ${formatCurrency(tax!.rbt12)}` }] : [],
    });
  },
};

/* ─────────────────────────── TRIBUTÁRIO ─────────────────────────── */

const dasVencendo: AuditRule = {
  id: "tributario_das_vencendo",
  category: "tributario",
  label: "DAS vencendo",
  severity: "medium",
  run: (d) => {
    const tax = d.tax;
    const due = tax?.dueDate ?? null;
    const unpaid = !!tax && tax.dasStatus !== "paid" && tax.dasAmount > 0;
    const days = due ? daysBetween(d.today, due) : null;
    const vencendo = unpaid && days !== null && days >= 0 && days <= 5;
    return finding({
      id: "tributario_das_vencendo",
      category: "tributario",
      severity: "medium",
      title: "DAS a vencer nos próximos dias",
      description: vencendo
        ? `DAS de ${tax!.competence} vence em ${days} dia(s) — ${formatCurrency(tax!.dasAmount)}.`
        : "",
      recommendation: "Programe o pagamento da guia antes do vencimento.",
      link: "abrir_tributario",
      items: vencendo ? [{ id: `das-${tax!.competence}`, label: `DAS ${tax!.competence}` }] : [],
    });
  },
};

const dasAtrasado: AuditRule = {
  id: "tributario_das_atrasado",
  category: "tributario",
  label: "DAS atrasado",
  severity: "critical",
  run: (d) => {
    const tax = d.tax;
    const due = tax?.dueDate ?? null;
    const unpaid = !!tax && tax.dasStatus !== "paid" && tax.dasAmount > 0;
    const atrasado = unpaid && !!due && due < d.today;
    return finding({
      id: "tributario_das_atrasado",
      category: "tributario",
      severity: "critical",
      title: "DAS vencido sem pagamento registrado",
      description: atrasado
        ? `DAS de ${tax!.competence} venceu em ${due} — ${formatCurrency(tax!.dasAmount)}.`
        : "",
      recommendation: "Regularize a guia o quanto antes para evitar multa e juros.",
      link: "abrir_tributario",
      items: atrasado
        ? [{ id: `das-atraso-${tax!.competence}`, label: `DAS ${tax!.competence}` }]
        : [],
    });
  },
};

const rbt12MudancaFaixa: AuditRule = {
  id: "tributario_rbt12_mudanca_faixa",
  category: "tributario",
  label: "RBT12 próximo da mudança de faixa",
  severity: "medium",
  run: (d) => {
    const tax = d.tax;
    const distance = tax?.distanceToNextBracket ?? null;
    const near =
      !!tax && distance !== null && distance >= 0 && tax.rbt12 > 0 && distance <= tax.rbt12 * 0.1;
    return finding({
      id: "tributario_rbt12_mudanca_faixa",
      category: "tributario",
      severity: "medium",
      title: "RBT12 perto de mudar de faixa",
      description: near
        ? `Faltam ${formatCurrency(distance!)} para a próxima faixa do Simples.`
        : "",
      recommendation: "Simule o impacto na alíquota antes de aumentar o faturamento.",
      link: "abrir_tributario",
      items: near ? [{ id: `faixa-${tax!.competence}`, label: `Faixa ${tax!.bracket ?? "-"}` }] : [],
    });
  },
};

/* ──────────────────────────── CONTÁBIL ──────────────────────────── */

const PROLABORE_RX = /pro\s?-?labore/i;
const DISTRIBUICAO_RX = /(distribui|dividend|lucros? dos? s[oó]cios?)/i;

const prolaboreNaoRegistrado: AuditRule = {
  id: "contabil_prolabore_nao_registrado",
  category: "contabil",
  label: "Pró-labore não registrado",
  severity: "medium",
  run: (d) => {
    const registrado = d.transactions.some(
      (t) => t.type === "expense" && PROLABORE_RX.test(t.description),
    );
    return finding({
      id: "contabil_prolabore_nao_registrado",
      category: "contabil",
      severity: "medium",
      title: "Pró-labore não registrado",
      description: "Nenhum lançamento de pró-labore encontrado no período analisado.",
      recommendation: "Registre o pró-labore para separar retirada de lucro.",
      link: "abrir_financeiro",
      items: registrado ? [] : [{ id: "prolabore", label: "Sem lançamento de pró-labore" }],
    });
  },
};

const distribuicaoAcimaLucro: AuditRule = {
  id: "contabil_distribuicao_acima_lucro",
  category: "contabil",
  label: "Distribuição acima do lucro",
  severity: "critical",
  run: (d) => {
    const distributed = d.transactions
      .filter((t) => t.type === "expense" && DISTRIBUICAO_RX.test(t.description))
      .reduce((sum, t) => sum + t.amount, 0);
    const profit = d.netProfit;
    const excede = profit !== null && distributed > 0 && distributed > profit;
    return finding({
      id: "contabil_distribuicao_acima_lucro",
      category: "contabil",
      severity: "critical",
      title: "Distribuição de lucros acima do resultado",
      description: excede
        ? `Distribuído ${formatCurrency(distributed)} contra lucro de ${formatCurrency(profit!)}.`
        : "",
      recommendation: "Ajuste a distribuição ao lucro apurado para evitar risco fiscal.",
      link: "abrir_relatorios",
      items: excede ? [{ id: "distribuicao", label: "Distribuição maior que o lucro" }] : [],
    });
  },
};

const lucroNegativo: AuditRule = {
  id: "contabil_lucro_negativo",
  category: "contabil",
  label: "Lucro negativo",
  severity: "high",
  run: (d) => {
    const negativo = d.netProfit !== null && d.netProfit < 0;
    return finding({
      id: "contabil_lucro_negativo",
      category: "contabil",
      severity: "high",
      title: "Resultado negativo no período",
      description: negativo ? `Prejuízo de ${formatCurrency(Math.abs(d.netProfit!))}.` : "",
      recommendation: "Revise despesas, preços e mix de produtos.",
      link: "abrir_relatorios",
      items: negativo ? [{ id: "lucro", label: "Prejuízo no período" }] : [],
    });
  },
};

const patrimonioNegativo: AuditRule = {
  id: "contabil_patrimonio_negativo",
  category: "contabil",
  label: "Patrimônio líquido negativo",
  severity: "critical",
  run: (d) => {
    const negativo = d.equity !== null && d.equity < 0;
    return finding({
      id: "contabil_patrimonio_negativo",
      category: "contabil",
      severity: "critical",
      title: "Patrimônio líquido negativo",
      description: negativo ? `Patrimônio líquido de ${formatCurrency(d.equity!)}.` : "",
      recommendation: "Converse com a contabilidade sobre capitalização da empresa.",
      link: "abrir_relatorios",
      items: negativo ? [{ id: "patrimonio", label: "Patrimônio líquido negativo" }] : [],
    });
  },
};

/** Registro oficial de verificações (ordem estável). */
export const AUDIT_RULES: readonly AuditRule[] = [
  contasVencidas,
  vendaSemLancamento,
  recebimentoDuplicado,
  valorNegativo,
  recebimentoInconsistente,
  caixaDivergente,
  caixaSessaoLonga,
  caixaSaldoIncompativel,
  estoqueNegativo,
  produtoSemCusto,
  produtoSemPreco,
  abaixoDoMinimo,
  semMovimentacao,
  pfSemCpf,
  pjSemCnpj,
  semTelefone,
  clienteDuplicado,
  semNcm,
  semCst,
  semUnidade,
  semCategoria,
  inativoAnunciado,
  documentoRejeitado,
  xmlPendente,
  danfePendente,
  tetoSimples,
  dasVencendo,
  dasAtrasado,
  rbt12MudancaFaixa,
  prolaboreNaoRegistrado,
  distribuicaoAcimaLucro,
  lucroNegativo,
  patrimonioNegativo,
];

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  financeiro: "Financeiro",
  caixa: "Caixa",
  estoque: "Estoque",
  comercial: "Comercial",
  cadastros: "Cadastros",
  fiscal: "Fiscal",
  tributario: "Tributário",
  contabil: "Contábil",
};
