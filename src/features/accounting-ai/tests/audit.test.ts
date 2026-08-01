/**
 * Sprint 7.2 — Bella Auditora.
 *
 * A auditoria é READ-ONLY: os testes garantem que as regras apenas
 * identificam inconsistências, sem corrigir, gravar ou recalcular nada.
 */
import { describe, expect, it } from "vitest";
import {
  AUDIT_RULES,
  auditProvider,
  auditQueries,
  buildBellaAuditInsights,
  buildBellaAuditNotifications,
  computeAuditHealth,
  describeAudit,
  runAuditRules,
  type AuditDataset,
  type AuditRuleId,
  type AuditSnapshot,
} from "../audit";
import { accountingAiSkills } from "../skills";
import { detectIntent } from "../chat/intent-engine";
import { planIntent } from "../chat/planner";
import {
  makeAuditCashSession,
  makeAuditCustomer,
  makeAuditProduct,
  makeAuditSale,
  makeAuditTransaction,
  makeTestServices,
} from "./fixtures";

const TODAY = "2026-02-10";

function dataset(patch: Partial<AuditDataset> = {}): AuditDataset {
  return {
    today: TODAY,
    transactions: [],
    sales: [],
    cashSessions: [],
    products: [],
    customers: [],
    fiscalDocuments: [],
    fiscalDefaults: { defaultCst: "102" },
    stagnant: [],
    tax: null,
    summary: null,
    equity: 10_000,
    netProfit: 5_000,
    ...patch,
  };
}

function findingIds(snapshot: AuditSnapshot): AuditRuleId[] {
  return snapshot.findings.map((f) => f.id);
}

function run(patch: Partial<AuditDataset> = {}) {
  return runAuditRules(dataset(patch));
}

describe("Sprint 7.2 — motor de auditoria", () => {
  it("empresa saudável não gera nenhuma inconsistência", () => {
    const snapshot = run({
      products: [makeAuditProduct()],
      customers: [makeAuditCustomer()],
      transactions: [
        makeAuditTransaction(),
        makeAuditTransaction({
          id: "t-pro",
          type: "expense",
          description: "Pró-labore fevereiro",
          referenceId: null,
        }),
      ],
      sales: [makeAuditSale()],
      cashSessions: [makeAuditCashSession()],
    });
    expect(snapshot.findings).toHaveLength(0);
    expect(snapshot.counts.ok).toBe(snapshot.counts.total);
    expect(snapshot.health.level).toBe("ok");
    expect(snapshot.health.score).toBe(100);
  });

  it("executa todas as verificações declaradas", () => {
    const snapshot = run();
    expect(snapshot.checks).toHaveLength(AUDIT_RULES.length);
    expect(new Set(AUDIT_RULES.map((r) => r.id)).size).toBe(AUDIT_RULES.length);
  });
});

describe("Sprint 7.2 — verificações financeiras", () => {
  it("aponta contas vencidas", () => {
    const snapshot = run({
      transactions: [
        makeAuditTransaction({
          id: "t-venc",
          status: "pending",
          dueDate: "2026-01-05",
          paidAt: null,
        }),
      ],
    });
    expect(findingIds(snapshot)).toContain("fin_contas_vencidas");
  });

  it("aponta venda paga sem lançamento financeiro", () => {
    const snapshot = run({
      sales: [makeAuditSale({ id: "s-x", settledAt: null })],
      transactions: [],
    });
    const finding = snapshot.findings.find(
      (f) => f.id === "fin_venda_paga_sem_lancamento",
    );
    expect(finding?.entityIds).toContain("s-x");
  });

  it("aponta recebimento duplicado", () => {
    const snapshot = run({
      transactions: [
        makeAuditTransaction({ id: "a", referenceId: "s1" }),
        makeAuditTransaction({ id: "b", referenceId: "s1" }),
      ],
      sales: [makeAuditSale()],
    });
    expect(findingIds(snapshot)).toContain("fin_recebimento_duplicado");
  });

  it("aponta valores negativos", () => {
    const snapshot = run({
      transactions: [makeAuditTransaction({ id: "neg", amount: -50 })],
      sales: [],
    });
    expect(findingIds(snapshot)).toContain("fin_valor_negativo");
  });

  it("aponta recebimento inconsistente (pago sem data de pagamento)", () => {
    const snapshot = run({
      transactions: [makeAuditTransaction({ id: "inc", status: "paid", paidAt: null })],
      sales: [],
    });
    expect(findingIds(snapshot)).toContain("fin_recebimento_inconsistente");
  });
});

describe("Sprint 7.2 — verificações de caixa", () => {
  it("aponta caixa divergente", () => {
    const snapshot = run({
      cashSessions: [
        makeAuditCashSession({ id: "c1", difference: -35, countedCash: 465 }),
      ],
    });
    expect(findingIds(snapshot)).toContain("caixa_divergente");
  });

  it("aponta sessão aberta por tempo excessivo", () => {
    const snapshot = run({
      cashSessions: [
        makeAuditCashSession({
          id: "c2",
          status: "open",
          openedAt: "2026-02-05T08:00:00.000Z",
          closedAt: null,
          expectedCash: null,
          countedCash: null,
          difference: null,
        }),
      ],
    });
    expect(findingIds(snapshot)).toContain("caixa_sessao_longa");
  });

  it("aponta saldo incompatível entre esperado e contado", () => {
    const snapshot = run({
      cashSessions: [
        makeAuditCashSession({
          id: "c3",
          expectedCash: 500,
          countedCash: 420,
          difference: 0,
        }),
      ],
    });
    expect(findingIds(snapshot)).toContain("caixa_saldo_incompativel");
  });
});

describe("Sprint 7.2 — verificações de estoque e cadastros", () => {
  it("aponta estoque negativo", () => {
    const snapshot = run({ products: [makeAuditProduct({ id: "p-neg", stock: -3 })] });
    expect(findingIds(snapshot)).toContain("estoque_negativo");
  });

  it("aponta produto sem custo e sem preço", () => {
    const snapshot = run({
      products: [makeAuditProduct({ id: "p-sc", cost: 0, price: 0 })],
    });
    expect(findingIds(snapshot)).toEqual(
      expect.arrayContaining(["estoque_produto_sem_custo", "estoque_produto_sem_preco"]),
    );
  });

  it("aponta estoque abaixo do mínimo", () => {
    const snapshot = run({
      products: [makeAuditProduct({ id: "p-min", stock: 1, minStock: 5 })],
    });
    expect(findingIds(snapshot)).toContain("estoque_abaixo_minimo");
  });

  it("aponta produtos sem movimentação", () => {
    const snapshot = run({
      products: [makeAuditProduct()],
      stagnant: [{ id: "p-stag", name: "Parado", sku: "S1", stock: 8 }],
    });
    expect(findingIds(snapshot)).toContain("estoque_sem_movimentacao");
  });

  it("aponta cadastros fiscais incompletos", () => {
    const snapshot = run({
      products: [
        makeAuditProduct({ id: "p-cad", ncm: null, unit: null, categoryId: null }),
      ],
      fiscalDefaults: { defaultCst: null },
    });
    expect(findingIds(snapshot)).toEqual(
      expect.arrayContaining([
        "cadastro_produto_sem_ncm",
        "cadastro_produto_sem_unidade",
        "cadastro_produto_sem_categoria",
        "cadastro_sem_cst",
      ]),
    );
  });

  it("aponta produto inativo ainda anunciado no marketplace", () => {
    const snapshot = run({
      products: [
        makeAuditProduct({ id: "p-ml", status: "inactive", marketplaceId: "MLB1" }),
      ],
    });
    expect(findingIds(snapshot)).toContain("cadastro_inativo_anunciado");
  });
});

describe("Sprint 7.2 — verificações comerciais", () => {
  it("aponta PF sem CPF e PJ sem CNPJ", () => {
    const snapshot = run({
      customers: [
        makeAuditCustomer({ id: "pf", document: null }),
        makeAuditCustomer({ id: "pj", name: "Loja X LTDA", document: "123456789012" }),
      ],
    });
    const ids = findingIds(snapshot);
    expect(ids).toEqual(
      expect.arrayContaining(["comercial_pf_sem_cpf", "comercial_pj_sem_cnpj"]),
    );
  });

  it("aponta cliente sem telefone e duplicados", () => {
    const snapshot = run({
      customers: [
        makeAuditCustomer({ id: "c1", phone: null, whatsapp: null }),
        makeAuditCustomer({ id: "c2" }),
        makeAuditCustomer({ id: "c3" }),
      ],
    });
    const ids = findingIds(snapshot);
    expect(ids).toContain("comercial_sem_telefone");
    expect(ids).toContain("comercial_cliente_duplicado");
  });
});

describe("Sprint 7.2 — verificações fiscais, tributárias e contábeis", () => {
  it("aponta documento rejeitado e artefatos pendentes", () => {
    const snapshot = run({
      fiscalDocuments: [
        {
          id: "d1",
          number: 10,
          status: "rejected",
          saleId: "s1",
          xmlAuthorizedPath: null,
          danfePath: null,
          rejectionReason: "CST inválido",
        },
        {
          id: "d2",
          number: 11,
          status: "authorized",
          saleId: "s2",
          xmlAuthorizedPath: null,
          danfePath: null,
          rejectionReason: null,
        },
      ],
    });
    const ids = findingIds(snapshot);
    expect(ids).toEqual(
      expect.arrayContaining([
        "fiscal_documento_rejeitado",
        "fiscal_xml_pendente",
        "fiscal_danfe_pendente",
      ]),
    );
  });

  it("aponta lucro e patrimônio negativos", () => {
    const snapshot = run({ netProfit: -1_200, equity: -800 });
    expect(findingIds(snapshot)).toEqual(
      expect.arrayContaining(["contabil_lucro_negativo", "contabil_patrimonio_negativo"]),
    );
  });

  it("aponta pró-labore não registrado no período", () => {
    const snapshot = run({
      transactions: [makeAuditTransaction({ id: "t1", type: "expense", description: "Aluguel" })],
      sales: [],
    });
    expect(findingIds(snapshot)).toContain("contabil_prolabore_nao_registrado");
  });
});

describe("Sprint 7.2 — saúde operacional e ordenação", () => {
  it("ordena por severidade (crítico primeiro)", () => {
    const snapshot = run({
      products: [makeAuditProduct({ id: "p", stock: -1, ncm: null })],
    });
    const severities = snapshot.findings.map((f) => f.severity);
    const sorted = [...severities].sort(
      (a, b) =>
        ["critical", "high", "medium", "low"].indexOf(a) -
        ["critical", "high", "medium", "low"].indexOf(b),
    );
    expect(severities).toEqual(sorted);
  });

  it("calcula o score de saúde operacional", () => {
    expect(computeAuditHealth([], 10).score).toBe(100);
    const health = computeAuditHealth(
      [{ severity: "critical" } as never],
      10,
    );
    expect(health.level).toBe("critico");
    expect(health.score).toBe(90);
  });
});

describe("Sprint 7.2 — provider e degradação", () => {
  it("lê os motores oficiais e devolve um retrato disponível", async () => {
    const services = makeTestServices();
    const res = await auditProvider("company-1", { services });
    expect(res.available).toBe(true);
    expect(res.data?.checks.length).toBe(AUDIT_RULES.length);
  });

  it("degrada com nota amigável quando a leitura falha", async () => {
    const services = makeTestServices({ audit: { fail: true } });
    const res = await auditProvider("company-1", { services });
    expect(res.available).toBe(false);
    expect(res.data).toBeNull();
    expect(res.note).toBeTruthy();
  });
});

describe("Sprint 7.2 — chat, insights e notificações", () => {
  it("reconhece as intenções de auditoria", () => {
    expect(detectIntent("O que está errado?").intent).toBe("auditoria_geral");
    expect(detectIntent("faça uma auditoria").intent).toBe("auditoria_geral");
    expect(detectIntent("quais inconsistências existem?").intent).toBe(
      "consultar_inconsistencias",
    );
    expect(detectIntent("como está a saúde operacional?").intent).toBe(
      "consultar_saude_operacional",
    );
  });

  it("planeja apenas skills de auditoria existentes", () => {
    const plan = planIntent(detectIntent("O que está errado?"));
    expect(plan.steps.map((s) => s.skillId)).toEqual([
      "auditar_empresa",
      "consultar_inconsistencias",
    ]);
  });

  it("registra as skills de auditoria como somente leitura", () => {
    const ids = accountingAiSkills.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "auditar_empresa",
        "consultar_inconsistencias",
        "consultar_saude_operacional",
      ]),
    );
    expect(accountingAiSkills.every((s) => s.readOnly)).toBe(true);
  });

  it("gera insights e narra novas, recorrentes e resolvidas", () => {
    const snapshot = run({ products: [makeAuditProduct({ id: "p", stock: -2 })] });
    const insights = buildBellaAuditInsights(snapshot);
    expect(insights.length).toBeGreaterThan(0);

    const novo = buildBellaAuditNotifications(snapshot, { previous: { openIds: [] } });
    expect(novo.some((n) => /crítico|Nova inconsistência/i.test(n.title))).toBe(true);

    const clean = run({ products: [makeAuditProduct()] });
    const resolvido = buildBellaAuditNotifications(clean, {
      previous: { openIds: ["estoque_negativo"] },
    });
    expect(resolvido.some((n) => n.title.startsWith("Problema resolvido"))).toBe(true);
  });

  it("responde as consultas determinísticas de auditoria", () => {
    const snapshot = run({ products: [makeAuditProduct({ id: "p", stock: -2 })] });
    expect(auditQueries.saudeOperacional(snapshot).value).toBe(snapshot.health.score);
    expect(auditQueries.inconsistencias(snapshot).value).toBe(snapshot.findings.length);
    expect(auditQueries.problemasCriticos(null).available).toBe(false);
    expect(describeAudit(snapshot)).toMatch(/verifica/i);
  });
});
