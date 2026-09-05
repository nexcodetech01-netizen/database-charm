import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import type {
  FinanceOverview,
  FinancialAccountInsert,
  FinancialAccountUpdate,
  FinancialCategoryInsert,
  FinancialCategoryUpdate,
  FinancialTransactionInsert,
  FinancialTransactionUpdate,
  TransactionListFilters,
  TransactionWithMeta,
  SettleTransactionInput,
  CompleteSettlementInput,
  IncompleteSettlement,
} from "../types";

// Fonte única de tratamento temporal do Financeiro — nunca duplicar aqui.
import {
  DEFAULT_COMPANY_TZ,
  addDaysStr,
  companyDayKey,
  companyDayStartUtc,
  tzOffsetMs,
  tzParts,
} from "../lib/company-time";




/**
 * BUGFIX — timestamp real da liquidação no fuso da empresa.
 *
 * A UI envia a data (`YYYY-MM-DD`) já no fuso da empresa. O `paid_at`
 * gravado deve representar o instante universal (UTC) desse dia/hora na empresa.
 *
 * CAUSA DO ERRO: À noite (ex: 21:00 BRT = 00:00 UTC dia+1), se usássemos o agora
 * UTC como data base para uma data local retroativa ou "hoje", a lógica de ms 
 * construída via naive UTC acabava empurrando o instante para 24h depois.
 */
function toSettlementTimestamp(paidAt: string): string {
  const tz = DEFAULT_COMPANY_TZ;
  const now = new Date();

  if (paidAt && !/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) {
    return new Date(paidAt).toISOString();
  }

  // Data local na empresa (YYYY-MM-DD)
  const localDate = paidAt || companyDayKey(now, tz);

  // Capturamos as partes da hora ATUAL no fuso da empresa
  const p = tzParts(now, tz);
  const hh = Number(p.hour) === 24 ? 0 : Number(p.hour);
  const mm = Number(p.minute);
  const ss = Number(p.second);
  const ms = now.getMilliseconds();

  // Constrói o instante UTC que, no fuso da empresa, resulta em localDate + hora atual.
  // Usamos a infraestrutura testada de companyDayStartUtc.
  const dayStartMs = companyDayStartUtc(localDate, tz);
  const offsetMs = (hh * 3600 + mm * 60 + ss) * 1000 + ms;
  
  return new Date(dayStartMs + offsetMs).toISOString();
}

/** @internal EXPOSTO APENAS PARA TESTES DE INTEGRIDADE */
export const _test_toSettlementTimestamp = toSettlementTimestamp;


// P1.2 — Validação server-side de lançamentos financeiros.
const financialTransactionCreateSchema = z
  .object({
    company_id: z.string().uuid("Empresa inválida."),
    type: z.enum(["income", "expense", "transfer"], {
      message: "Selecione o tipo da movimentação.",
    }),
    description: z
      .string()
      .trim()
      .min(1, "Descrição é obrigatória.")
      .max(500, "Descrição muito longa."),
    amount: z.number().refine((v) => v !== 0, "Valor não pode ser zero."),
    transaction_date: z.string().trim().min(1, "Data é obrigatória."),
  })
  .passthrough();


export const financeService = {
  // ---------- Accounts ----------
  async listAccounts(companyId: string) {
    const { data, error } = await supabase
      .from("financial_accounts")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async createAccount(input: FinancialAccountInsert) {
    const payload = {
      ...input,
      current_balance: input.current_balance ?? input.initial_balance ?? 0,
    };
    const { data, error } = await supabase
      .from("financial_accounts")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async updateAccount(id: string, input: FinancialAccountUpdate) {
    // Ao atualizar o saldo inicial, precisamos garantir que o current_balance seja refletido
    // No frontend, passamos o novo initial_balance. O servidor via trigger ou lógica manual
    // deve atualizar o current_balance. Aqui fazemos um patch manual se initial_balance mudou.
    const { data: current } = await supabase
      .from("financial_accounts")
      .select("initial_balance, current_balance")
      .eq("id", id)
      .single();

    let payload = { ...input };
    
    if (input.initial_balance !== undefined && current) {
      const diff = Number(input.initial_balance) - Number(current.initial_balance || 0);
      payload.current_balance = Number(current.current_balance || 0) + diff;
    }

    const { data, error } = await supabase
      .from("financial_accounts")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async removeAccount(id: string) {
    const { error } = await supabase.from("financial_accounts").delete().eq("id", id);
    if (error) throw error;
  },

  // ---------- Categories ----------
  async listCategories(companyId: string) {
    const { data, error } = await supabase
      .from("financial_categories")
      .select("*")
      .eq("company_id", companyId)
      .order("kind", { ascending: true })
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
  async createCategory(input: FinancialCategoryInsert) {
    const { data, error } = await supabase
      .from("financial_categories")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async updateCategory(id: string, input: FinancialCategoryUpdate) {
    const { data, error } = await supabase
      .from("financial_categories")
      .update(input)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async removeCategory(id: string) {
    const { error } = await supabase.from("financial_categories").delete().eq("id", id);
    if (error) throw error;
  },

  // ---------- Transactions ----------
  async listTransactions(companyId: string, filters: TransactionListFilters) {
    let q = supabase
      .from("financial_transactions")
      .select(
        "*, category:financial_categories(name), financial_accounts!financial_transactions_account_id_fkey(name)",
        { count: "exact" },
      )
      .eq("company_id", companyId);

    if (filters.search.trim()) {
      const term = filters.search.trim();
      const s = `%${term}%`;

      // BUG ENCONTRADO E CORRIGIDO (2026-08-31): a busca nunca
      // encontrava nada digitando o NOME do cliente — ela olha só pro
      // texto já salvo em description/notes/reference_number, e o
      // nome do cliente é "descoberto" numa etapa separada, DEPOIS
      // que essa consulta já rodou (não existe como coluna aqui pra
      // comparar direto). Corrigido buscando ANTES quais vendas
      // pertencem a um cliente com nome parecido (direto, ou via
      // crediário), e incluindo essas vendas/parcelas no filtro.
      const { saleIds: saleIdsByName, installmentIds: installmentIdsByName } = await (async () => {
        const custRes = await supabase
          .from("customers")
          .select("id")
          .eq("company_id", companyId)
          .ilike("name", s);
        const customerIds = (custRes.data ?? []).map((c) => c.id);
        if (customerIds.length === 0) {
          return { saleIds: [] as string[], installmentIds: [] as string[] };
        }
        const salesRes = await supabase.from("sales").select("id").in("customer_id", customerIds);
        const saleIds = (salesRes.data ?? []).map((s2) => s2.id);
        if (saleIds.length === 0) {
          return { saleIds, installmentIds: [] as string[] };
        }
        const creditAccountsRes = await supabase
          .from("credit_accounts")
          .select("id")
          .in("sale_id", saleIds);
        const creditAccountIds = (creditAccountsRes.data ?? []).map((ca) => ca.id);
        const installmentsRes = creditAccountIds.length
          ? await supabase
              .from("credit_installments")
              .select("id")
              .in("credit_account_id", creditAccountIds)
          : { data: [] as { id: string }[] };
        const installmentIds = (installmentsRes.data ?? []).map((i) => i.id);
        return { saleIds, installmentIds };
      })();

      const orParts = [
        `description.ilike.${s}`,
        `notes.ilike.${s}`,
        `reference_number.ilike.${s}`,
      ];
      if (saleIdsByName.length > 0) {
        orParts.push(`and(source.eq.sale,reference_id.in.(${saleIdsByName.join(",")}))`);
      }
      if (installmentIdsByName.length > 0) {
        orParts.push(
          `and(source.eq.credit_payment,reference_id.in.(${installmentIdsByName.join(",")}))`,
        );
      }
      q = q.or(orParts.join(","));
    }
    if (filters.type) q = q.eq("type", filters.type);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.accountId) q = q.eq("account_id", filters.accountId);
    if (filters.categoryId) q = q.eq("category_id", filters.categoryId);

    q = q.order("transaction_date", { ascending: false }).order("created_at", { ascending: false });

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) {
      return { rows: [] as TransactionWithMeta[], total: count ?? 0 };
    }

    // BUG ENCONTRADO E CORRIGIDO (2026-08-26): essa consulta nunca
    // trazia o nome do cliente — só categoria e conta. `reference_id`
    // não é um relacionamento declarado no banco (é genérico, aponta
    // pra venda/compra/etc. dependendo de `source`), então não dá pra
    // "pedir junto" com o Supabase — precisa buscar em duas etapas,
    // igual já é feito em `listIncompleteSettlements` mais abaixo
    // nesse mesmo arquivo.
    const saleIds = [
      ...new Set(
        rows.filter((r) => (r as any).source === "sale" && (r as any).reference_id)
          .map((r) => (r as any).reference_id as string),
      ),
    ];

    // BUG ENCONTRADO E CORRIGIDO (2026-08-31): o "saldo do crediário"
    // (lançamento criado ao converter uma venda pra crediário —
    // `source = 'credit_payment'`, `reference_id` apontando pra uma
    // PARCELA, não pra uma venda direto) nunca tinha nome de cliente
    // resolvido — só os de `source = 'sale'` eram tratados acima. Sem
    // o nome, esses lançamentos ficam sem aparecer em buscas por nome
    // de cliente na tela de Financeiro, e o título mostra só o número
    // da venda. Corrigido buscando a cadeia parcela → conta de
    // crediário → venda → cliente, mesma lógica de duas etapas já
    // usada acima.
    const installmentIds = [
      ...new Set(
        rows.filter((r) => (r as any).source === "credit_payment" && (r as any).reference_id)
          .map((r) => (r as any).reference_id as string),
      ),
    ];
    const installmentsRes = installmentIds.length
      ? await supabase
          .from("credit_installments")
          .select("id, credit_account_id")
          .in("id", installmentIds)
      : { data: [] as { id: string; credit_account_id: string }[] };
    const installments = installmentsRes.data ?? [];
    const creditAccountIds = [...new Set(installments.map((i) => i.credit_account_id).filter(Boolean))];
    const creditAccountsRes = creditAccountIds.length
      ? await supabase.from("credit_accounts").select("id, sale_id").in("id", creditAccountIds)
      : { data: [] as { id: string; sale_id: string }[] };
    const creditAccounts = creditAccountsRes.data ?? [];
    const creditSaleIds = [...new Set(creditAccounts.map((ca) => ca.sale_id).filter(Boolean))];

    const salesRes = saleIds.length || creditSaleIds.length
      ? await supabase
          .from("sales")
          .select("id, customer_id")
          .in("id", [...new Set([...saleIds, ...creditSaleIds])])
      : { data: [] as { id: string; customer_id: string | null }[] };
    const sales = salesRes.data ?? [];
    const customerIds = [...new Set(sales.map((s) => s.customer_id).filter(Boolean))] as string[];
    const customersRes = customerIds.length
      ? await supabase.from("customers").select("id, name").in("id", customerIds)
      : { data: [] as { id: string; name: string }[] };
    const customerNameById = new Map((customersRes.data ?? []).map((c) => [c.id, c.name]));
    const customerNameBySaleId = new Map(
      sales.map((s) => [s.id, s.customer_id ? customerNameById.get(s.customer_id) ?? null : null]),
    );
    const saleIdByCreditAccountId = new Map(creditAccounts.map((ca) => [ca.id, ca.sale_id]));
    const creditAccountIdByInstallmentId = new Map(
      installments.map((i) => [i.id, i.credit_account_id]),
    );

    return {
      rows: rows.map<TransactionWithMeta>((r) => {
        const cat = (r as any).category;
        const source = (r as any).source;
        const refId = (r as any).reference_id;
        let customerName: string | null = null;
        if (source === "sale" && refId) {
          customerName = customerNameBySaleId.get(refId) ?? null;
        } else if (source === "credit_payment" && refId) {
          const creditAccountId = creditAccountIdByInstallmentId.get(refId);
          const saleId = creditAccountId ? saleIdByCreditAccountId.get(creditAccountId) : undefined;
          customerName = saleId ? customerNameBySaleId.get(saleId) ?? null : null;
        }
        return {
          ...r,
          account_name: (r as any).financial_accounts?.name ?? null,
          category_name: cat?.name ?? (r as any).category_name ?? null,
          customer_name: customerName,
        };
      }),
      total: count ?? 0,
    };
  },

  /**
   * Criação de lançamento manual. O INSERT NUNCA grava `status = 'paid'`:
   * todo lançamento nasce em aberto (`pending`) e a baixa é feita
   * exclusivamente pelo motor (`settle_financial_transaction`).
   */
  async createTransaction(input: FinancialTransactionInsert) {
    const parsed = financialTransactionCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => i.message).join(" · "));
    }
    
    // Remove UI-only fields and sanitize category field
    const { 
      status: _status, 
      paid_at: _paidAt, 
      payment_condition,
      installment_count,
      installment_interval_days,
      first_installment_date,
      category: _category,
      ...rest 
    } = input as any;
    
    void _status;
    void _paidAt;
    void payment_condition;
    void installment_count;
    void installment_interval_days;
    void first_installment_date;
    void _category;

    const payload = {
      ...rest,
      category_id: input.category_id || null,
      status: _status === "cancelled" ? "cancelled" : "pending",
    } as FinancialTransactionInsert;

    const { data, error } = await supabase
      .from("financial_transactions")
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Erro Supabase (Insert financial_transactions):', {
        error,
        payload,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    return data;
  },

  /**
   * Cadastro manual já pago: cria o lançamento em aberto e, na sequência,
   * executa o motor de liquidação. Não existe caminho de INSERT direto com
   * `status = 'paid'`.
   */
  async createAndSettleTransaction(
    input: FinancialTransactionInsert & {
      payment_condition?: "cash" | "installments";
      installment_count?: number;
      installment_interval_days?: number;
      first_installment_date?: string;
    },
    settle: SettleTransactionInput,
  ) {
    if (input.payment_condition === "installments" && input.installment_count && input.installment_count > 1) {
      const count = input.installment_count;
      const interval = input.installment_interval_days || 30;
      const amountPerInstallment = Number(((input.amount || 0) / count).toFixed(2));
      const firstDateStr = input.first_installment_date || input.transaction_date || companyDayKey(new Date(), DEFAULT_COMPANY_TZ);
      
      const transactions = [];
      for (let i = 0; i < count; i++) {
        const dueDate = addDaysStr(firstDateStr, i * interval);

        const { 
          payment_condition: _pc, 
          installment_count: _ic, 
          installment_interval_days: _iid, 
          first_installment_date: _fid, 
          ...basePayload 
        } = input as any;
        void _pc; void _ic; void _iid; void _fid;

        const installmentPayload = {
          ...basePayload,
          description: `${input.description} (${i + 1}/${count})`,
          amount: amountPerInstallment,
          due_date: dueDate,
          transaction_date: input.transaction_date,
          status: "pending",
        };
        
        transactions.push(this.createTransaction(installmentPayload as FinancialTransactionInsert));
      }
      
      const results = await Promise.all(transactions);
      
      if (settle && results.length > 0) {
        await this.settleTransaction(results[0].id, settle);
      }
      
      return results[0];
    }

    const { 
      payment_condition: _pc, 
      installment_count: _ic, 
      installment_interval_days: _iid, 
      first_installment_date: _fid, 
      ...cleanInput 
    } = input as any;
    void _pc; void _ic; void _iid; void _fid;

    const created = await this.createTransaction(cleanInput as FinancialTransactionInsert);
    if (settle) {
      await this.settleTransaction(created.id, settle);
    }
    return created;
  },




  /**
   * Edição cadastral do lançamento (descrição, valor, contas, categoria,
   * datas, notas).
   * 
   * REGRA ENTERPRISE (Sprint 8.3): Permite edição de qualquer lançamento,
   * incluindo os já pagos (paid), para correções de categoria (ex: Aporte de Sócio),
   * descrição ou valor. O status e paid_at continuam protegidos e só mudam via motor.
   */
  async updateTransaction(id: string, input: FinancialTransactionUpdate) {
    const {
      status: _status,
      paid_at: _paidAt,
      payment_condition,
      installment_count,
      installment_interval_days,
      first_installment_date,
      category: _category,
      ...safeInput
    } = input as any;
    
    void _status;
    void _paidAt;
    void payment_condition;
    void installment_count;
    void installment_interval_days;
    void first_installment_date;
    void _category;

    const payload = {
      ...safeInput,
      category_id: input.category_id || null,
    };

    const { data, error } = await supabase
      .from("financial_transactions")
      .update(payload as FinancialTransactionUpdate)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error('Erro Supabase (Update financial_transactions):', {
        error,
        inputId: id,
        safeInput,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    return data;
  },
  /**
   * Cancelamento de lançamento em aberto. Único status admitido: `cancelled`.
   * Baixa e estorno passam obrigatoriamente pelas RPCs do motor financeiro.
   */
  async setTransactionStatus(id: string, status: string) {
    if (status !== "cancelled") {
      throw new Error(
        "Alteração de situação não permitida por esta via. Utilize a baixa financeira (receber/pagar) ou o estorno. Este método só cancela lançamentos em aberto.",
      );
    }
    const patch: FinancialTransactionUpdate = { status: "cancelled" };
    const { data, error } = await supabase
      .from("financial_transactions")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /**
   * Motor único de estorno. Desfaz a liquidação (cash_out espelhado, reversão
   * do saldo da conta e volta para pending). Nunca alterar `status` direto.
   */
  async reverseTransaction(id: string, notes?: string) {
    const { data, error } = await supabase.rpc("reverse_financial_transaction", {
      _transaction_id: id,
      _notes: notes?.trim() ? notes.trim() : undefined,
    });
    if (error) {
      if (error.message?.includes("CAIXA_FECHADO")) {
        throw new Error(
          "Não há caixa aberto. Abra o caixa para estornar este recebimento.",
        );
      }
      throw error;
    }
    return data;
  },

  /**
   * Baixa de um lançamento registrando a forma de recebimento/pagamento.
   * Não altera `sales.payment_method` — a sincronização com a venda continua
   * a cargo dos triggers existentes.
   */
  async settleTransaction(id: string, input: SettleTransactionInput) {
    // Regra de negócio única (RPC): valida caixa aberto quando a conta é do
    // tipo Caixa, cria o cash_movement, atualiza o saldo da conta e baixa o
    // lançamento. Nunca duplicar essa lógica no cliente.
    const { data, error } = await supabase.rpc("settle_financial_transaction", {
      _transaction_id: id,
      _payment_method: input.paymentMethod,
      _account_id: input.accountId,
      // HOTFIX: `paid_at` precisa ser o instante real da liquidação.
      // A tela informa apenas a data; a hora é a do momento da baixa.
      _paid_at: toSettlementTimestamp(input.paidAt),
      _notes: input.notes?.trim() ? input.notes.trim() : undefined,
      // Desconto/acréscimo (modo "full") ou valor pago agora (modo "partial").
      _settled_amount:
        typeof input.settledAmount === "number" && Number.isFinite(input.settledAmount)
          ? input.settledAmount
          : undefined,
      _settlement_mode: input.settlementMode ?? "full",
      _remaining_due_date: input.remainingDueDate ?? undefined,



    });
    if (error) {
      if (error.message?.includes("CAIXA_FECHADO")) {
        throw new Error(
          "Não há caixa aberto. Abra o caixa para receber nesta conta.",
        );
      }
      throw error;
    }
    return data;
  },

  // ---------- Saneamento de baixas antigas ----------
  /**
   * Lançamentos já baixados (status = 'paid') que ficaram sem forma de
   * recebimento e/ou sem conta de destino (baixas anteriores à migração).
   */
  async listIncompleteSettlements(companyId: string): Promise<IncompleteSettlement[]> {
    const { data, error } = await supabase
      .from("financial_transactions")
      .select(
        "id, description, amount, type, paid_at, transaction_date, payment_method, account_id, source, reference_id",
      )
      .eq("company_id", companyId)
      .eq("status", "paid")
      .or("payment_method.is.null,account_id.is.null")
      .order("paid_at", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) throw error;

    const rows = data ?? [];
    const accountIds = [...new Set(rows.map((r) => r.account_id).filter(Boolean))] as string[];
    const saleIds = [
      ...new Set(
        rows.filter((r) => r.source === "sale" && r.reference_id).map((r) => r.reference_id as string),
      ),
    ];

    const [accountsRes, salesRes] = await Promise.all([
      accountIds.length
        ? supabase.from("financial_accounts").select("id, name").in("id", accountIds)
        : Promise.resolve({ data: [], error: null } as const),
      saleIds.length
        ? supabase.from("sales").select("id, number, customer_id").in("id", saleIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);

    const accountName = new Map((accountsRes.data ?? []).map((a) => [a.id, a.name]));
    const sales = salesRes.data ?? [];
    const customerIds = [...new Set(sales.map((s) => s.customer_id).filter(Boolean))] as string[];
    const customersRes = customerIds.length
      ? await supabase.from("customers").select("id, name").in("id", customerIds)
      : ({ data: [] } as { data: { id: string; name: string }[] });
    const customerName = new Map((customersRes.data ?? []).map((c) => [c.id, c.name]));
    const saleMap = new Map(
      sales.map((s) => [
        s.id,
        {
          sale_number: (s.number as string | null) ?? null,
          customer_name: s.customer_id ? customerName.get(s.customer_id) ?? null : null,
        },
      ]),
    );

    return rows.map((r) => {
      const sale = r.source === "sale" && r.reference_id ? saleMap.get(r.reference_id) : undefined;
      return {
        id: r.id,
        description: r.description,
        amount: Number(r.amount ?? 0),
        type: r.type,
        paid_at: r.paid_at,
        transaction_date: r.transaction_date,
        payment_method: r.payment_method,
        account_id: r.account_id,
        account_name: r.account_id ? accountName.get(r.account_id) ?? null : null,
        sale_number: sale?.sale_number ?? null,
        customer_name: sale?.customer_name ?? null,
      } satisfies IncompleteSettlement;
    });
  },

  /**
   * Complementa uma baixa antiga. A RPC só contabiliza saldo/cash_movement
   * quando o lançamento não tinha conta definida (evita duplicidade).
   */
  async completeSettlement(id: string, input: CompleteSettlementInput) {
    const { data, error } = await supabase.rpc("complete_settlement_data", {
      _transaction_id: id,
      _payment_method: input.paymentMethod,
      _account_id: input.accountId,
      _notes: input.notes?.trim() ? input.notes.trim() : undefined,
    });
    if (error) {
      if (error.message?.includes("CAIXA_FECHADO")) {
        throw new Error("Não há caixa aberto. Abra o caixa para regularizar nesta conta.");
      }
      throw error;
    }
    return data;
  },

  /**
   * Exclusão de lançamentos.
   *
   * Sprint 8.5: Se o lançamento estiver 'paid' (liquidado), executa o estorno
   * automático via motor ('reverse_financial_transaction') antes da deleção.
   * Lançamentos originados por processos de negócio (venda, compra, etc) continuam
   * protegidos contra exclusão direta para manter a integridade, mas o erro de 
   * "liquidado" foi removido em favor do estorno automático para itens manuais.
   */
  async removeTransaction(id: string) {
    const { data: tx, error: readErr } = await supabase
      .from("financial_transactions")
      .select("id,status,source,description")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw readErr;
    if (!tx) throw new Error("Lançamento financeiro não encontrado.");

    const source = (tx.source ?? "manual").toLowerCase();
    
    // 1. Proteção de integridade: Processos automáticos do ERP não podem ser excluídos pelo Financeiro
    if (source !== "manual" && source !== "transfer") {
      throw new Error(
        `Lançamentos originados por '${tx.source}' não podem ser excluídos. Cancele ou estorne o processo de origem (venda/compra).`,
      );
    }

    // 2. Se liquidado, estorna primeiro (Motor Financeiro V2)
    if (tx.status === "paid") {
      const { error: revErr } = await supabase.rpc("reverse_financial_transaction", {
        _transaction_id: id,
        _notes: `Estorno automático para exclusão do lançamento: ${tx.description}`,
      });
      
      if (revErr) {
        if (revErr.message?.includes("CAIXA_FECHADO")) {
          throw new Error("Não é possível excluir: o lançamento está liquidado e o caixa está fechado. Abra o caixa para permitir o estorno automático.");
        }
        throw revErr;
      }
    }

    // 3. Deleta o registro (ou marca como deletado se preferir, aqui usamos delete real conforme solicitado)
    const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
    if (error) throw error;
  },


  // ---------- Overview / Cash Flow ----------
  async overview(companyId: string): Promise<FinanceOverview> {
    const [accountsRes, txRes, todayRes, companyRes] = await Promise.all([
      supabase
        .from("financial_accounts")
        .select("current_balance,status")
        .eq("company_id", companyId),
      supabase
        .from("financial_transactions")
        .select("id,type,status,amount,transaction_date,due_date,description,paid_at,category_id")
        .eq("company_id", companyId)
        .neq("status", "cancelled"),
      // P2.4 — "hoje" no fuso horário da empresa (fonte da verdade no servidor)
      supabase.rpc("company_today", { _company_id: companyId }),
      supabase.from("companies").select("timezone").eq("id", companyId).maybeSingle(),
    ]);
    if (accountsRes.error) throw accountsRes.error;
    if (txRes.error) throw txRes.error;

    const todayStr =
      (typeof todayRes.data === "string" && todayRes.data) ||
      new Date().toISOString().slice(0, 10);
    const today = new Date(`${todayStr}T00:00:00`);
    const companyTz = companyRes.data?.timezone?.trim() || DEFAULT_COMPANY_TZ;
    // HOTFIX — "hoje" por INSTANTES (mesmo critério do Caixa), nunca por string.
    const dayStart = companyDayStartUtc(todayStr, companyTz);
    const dayEnd = companyDayStartUtc(addDaysStr(todayStr, 1), companyTz);

    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);

    const currentBalance = (accountsRes.data ?? [])
      .filter((a) => a.status === "active")
      .reduce((s, a) => s + Number(a.current_balance ?? 0), 0);

    const tx = txRes.data ?? [];
    
    // Pega as categorias para identificar taxas/deduções (ex: Bella Pay, Taxas Cartão, Estornos)
    const { data: categories } = await supabase
      .from("financial_categories")
      .select("id, name")
      .eq("company_id", companyId);
    
    const categoryMap = new Map((categories ?? []).map(c => [c.id, c.name.toLowerCase()]));
    const isTaxOrDeduction = (catId: string | null) => {
      if (!catId) return false;
      const name = categoryMap.get(catId) || "";
      return name.includes("taxa") || name.includes("estorno") || name.includes("reembolso") || name.includes("dedução");
    };

    // Não pagos e não estornados/cancelados — usados nas 3 faixas.
    const openIncome = tx.filter(
      (t) =>
        t.type === "income" &&
        t.status !== "paid" &&
        t.status !== "refunded",
    );
    const receivable = openIncome.reduce(
      (s, t) => s + Number(t.amount ?? 0),
      0,
    );
    let receivableOverdue = 0;
    let receivableDue30 = 0;
    let receivableDue60Plus = 0;
    for (const t of openIncome) {
      const ref = t.due_date ?? t.transaction_date;
      const amt = Number(t.amount ?? 0);
      const d = ref ? new Date(`${ref}T00:00:00`) : null;
      if (!d || d < today) receivableOverdue += amt;
      else if (d <= in30) receivableDue30 += amt;
      else receivableDue60Plus += amt;
    }

    const payable = tx
      .filter(
        (t) =>
          t.type === "expense" &&
          t.status !== "paid" &&
          t.status !== "refunded",
      )
      .reduce((s, t) => s + Number(t.amount ?? 0), 0);
    const projected = currentBalance + receivable - payable;

    // Realizado do mês — critério ÚNICO do dashboard: paid_at por INSTANTE
    // no fuso da empresa (mesmo tratamento de receiptsToday). Nunca
    // transaction_date, que representa competência/previsão.
    const monthStartStr = `${todayStr.slice(0, 7)}-01`;
    const monthStart = companyDayStartUtc(monthStartStr, companyTz);
    const paidInMonth = (t: { paid_at: string | null }) => {
      if (!t.paid_at) return false;
      const ts = new Date(t.paid_at).getTime();
      // Limite superior = início do dia seguinte a hoje no fuso da empresa
      // (mesmo `dayEnd` usado por receiptsToday), garantindo consistência.
      return Number.isFinite(ts) && ts >= monthStart && ts < dayEnd;
    };

    const monthTransactions = tx.filter(t => t.status === "paid" && paidInMonth(t));
    
    const grossRevenue = monthTransactions
      .filter(t => t.type === "income")
      .reduce((s, t) => s + Number(t.amount ?? 0), 0);

    const taxesAndDeductions = monthTransactions
      .filter(t => t.type === "expense" && isTaxOrDeduction(t.category_id))
      .reduce((s, t) => s + Number(t.amount ?? 0), 0);

    const monthIncome = grossRevenue; // No financeiro, income é o que entrou bruto em receitas

    const monthExpense = monthTransactions
      .filter(t => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount ?? 0), 0);
    
    const monthProfit = grossRevenue - monthExpense;


    // Recebimentos de hoje = dinheiro que efetivamente entrou (baixas do dia).
    // Comparação por INSTANTE no fuso da empresa: dayStart <= paid_at < dayEnd.
    const paidToday = (t: { paid_at: string | null }) => {
      if (!t.paid_at) return false;
      const ts = new Date(t.paid_at).getTime();
      return Number.isFinite(ts) && ts >= dayStart && ts < dayEnd;
    };

    const receiptsToday = tx
      .filter((t) => t.type === "income" && t.status === "paid" && paidToday(t))
      .reduce((s, t) => s + Number(t.amount ?? 0), 0);
    const receiptsTodayCount = tx.filter(
      (t) => t.type === "income" && t.status === "paid" && paidToday(t),
    ).length;


    // KPI Home "Dinheiro para entrar" — estritamente status = 'pending'
    // (não inclui overdue/refunded/cancelled) e sempre em financial_transactions.
    const pendingIncome = tx.filter(
      (t) => t.type === "income" && t.status === "pending",
    );
    const pendingReceivable = pendingIncome.reduce(
      (s, t) => s + Number(t.amount ?? 0),
      0,
    );

    const sortByDate = <T extends { due_date: string | null; transaction_date: string }>(a: T, b: T) =>
      (a.due_date ?? a.transaction_date).localeCompare(b.due_date ?? b.transaction_date);

    const upcoming = tx
      .filter((t) => t.status === "pending" || t.status === "overdue")
      .sort(sortByDate)
      .slice(0, 20);

    return {
      currentBalance,
      receivable,
      receivableOverdue,
      receivableDue30,
      receivableDue60Plus,
      payable,
      projected,
      monthIncome,
      monthExpense,
      receiptsToday,
      receiptsTodayCount,
      pendingReceivable,
      pendingReceivableCount: pendingIncome.length,

      upcomingIncome: upcoming
        .filter((t) => t.type === "income")
        .slice(0, 5)
        .map((t) => ({
          id: t.id,
          description: t.description,
          date: t.due_date ?? t.transaction_date,
          amount: Number(t.amount ?? 0),
        })),
      upcomingExpense: upcoming
        .filter((t) => t.type === "expense")
        .slice(0, 5)
        .map((t) => ({
          id: t.id,
          description: t.description,
          date: t.due_date ?? t.transaction_date,
          amount: Number(t.amount ?? 0),
        })),
      grossRevenue,
      taxesAndDeductions,
      monthProfit,
    };
  },
};
