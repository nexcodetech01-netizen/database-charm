import { supabase } from "@/integrations/supabase/client";
import type {
  CreateReturnInput,
  RefundStatus,
  SaleReturn,
  SaleReturnItem,
  SaleReturnWithItems,
} from "../types";

// Nota: numeração e cálculo de total agora são feitos DENTRO da RPC
// `public.create_sale_return` (fonte da verdade). Ver HOTFIX-003.


export const returnsService = {
  /**
   * List returns for a sale (with items).
   */
  async listBySale(saleId: string): Promise<SaleReturnWithItems[]> {
    const { data: returns, error } = await supabase
      .from("sale_returns")
      .select("*")
      .eq("sale_id", saleId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = returns ?? [];
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const { data: items, error: ierr } = await supabase
      .from("sale_return_items")
      .select("*")
      .in("return_id", ids);
    if (ierr) throw ierr;
    const byRet = new Map<string, SaleReturnItem[]>();
    (items ?? []).forEach((it) => {
      const arr = byRet.get(it.return_id) ?? [];
      arr.push(it);
      byRet.set(it.return_id, arr);
    });
    return rows.map((r) => ({ ...r, items: byRet.get(r.id) ?? [] }));
  },

  /**
   * Compute per-sale-item quantity already returned (across all returns).
   */
  async returnedQuantitiesFor(saleId: string): Promise<Map<string, number>> {
    const returns = await this.listBySale(saleId);
    const map = new Map<string, number>();
    for (const ret of returns) {
      if (ret.status === "failed") continue;
      for (const it of ret.items) {
        if (!it.sale_item_id) continue;
        map.set(
          it.sale_item_id,
          (map.get(it.sale_item_id) ?? 0) + Number(it.quantity),
        );
      }
    }
    return map;
  },

  /**
   * Cria uma devolução de forma ATÔMICA (HOTFIX-003).
   *
   * Toda a persistência (sale_return + sale_return_items + inventory_movements
   * + financial_transaction) roda dentro da RPC `public.create_sale_return`,
   * numa única transação Postgres. Se qualquer etapa falhar, o Postgres faz
   * ROLLBACK total — não sobra devolução, item, estoque ou financeiro
   * parcialmente gravado.
   *
   * Idempotência: o cliente envia um `client_request_id` (uuid). Chamar a
   * mesma devolução duas vezes com o mesmo id retorna a devolução já
   * persistida, sem duplicar estoque/financeiro/estorno.
   *
   * Bella Pay / pagamentos digitais: apenas registra `refund_status =
   * 'requested'`. A confirmação continua via webhook, fora da transação.
   */
  async create(
    input: CreateReturnInput & { clientRequestId?: string },
  ): Promise<SaleReturnWithItems> {
    if (!input.reason.trim()) throw new Error("Motivo obrigatório.");
    const validItems = input.items.filter((i) => i.quantity > 0);
    if (validItems.length === 0)
      throw new Error("Selecione ao menos um item para devolução.");

    const clientRequestId =
      input.clientRequestId ??
      (globalThis.crypto?.randomUUID?.() ?? undefined);

    const payload = {
      company_id: input.companyId,
      sale_id: input.saleId,
      reason: input.reason.trim(),
      notes: input.notes ?? null,
      client_request_id: clientRequestId ?? null,
      items: validItems.map((i) => ({
        sale_item_id: i.sale_item_id,
        product_id: i.product_id,
        description: i.description,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    };

    // Chamada única. O Postgres garante atomicidade (rollback total em erro).
    const { data, error } = await supabase.rpc("create_sale_return", {
      _input: payload as never,
    });
    if (error) throw error;

    const returnId =
      (data as { return_id?: string } | null)?.return_id ?? null;
    if (!returnId) throw new Error("Devolução não foi persistida.");

    // Hidrata cabeçalho + itens já persistidos (fonte da verdade no banco).
    const [{ data: header, error: hErr }, { data: items, error: iErr }] =
      await Promise.all([
        supabase
          .from("sale_returns")
          .select("*")
          .eq("id", returnId)
          .single(),
        supabase
          .from("sale_return_items")
          .select("*")
          .eq("return_id", returnId),
      ]);
    if (hErr) throw hErr;
    if (iErr) throw iErr;

    const ret = header as SaleReturn;
    return { ...ret, items: (items ?? []) as SaleReturnItem[] };
  },


  async updateRefundStatus(
    returnId: string,
    status: RefundStatus,
    message?: string | null,
  ): Promise<void> {
    const { error } = await supabase
      .from("sale_returns")
      .update({ refund_status: status, refund_message: message ?? null })
      .eq("id", returnId);
    if (error) throw error;
  },
};
