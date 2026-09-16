import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { updateRow } from "@/services/supabase.service";
import { generateNextSku } from "@/features/products/lib/sku-generator";
import type {
  PurchaseInsert,
  PurchaseItemDraft,
  PurchaseListFilters,
  PurchaseUpdate,
  PurchaseWithItems,
  PurchaseWithMeta,
} from "../types";

import { computeItemTotal, computeTotals } from "../types";

/**
 * Para itens sem `product_id` (linha manual / importação), cria automaticamente
 * o produto no catálogo com SKU gerado, custo = preço unitário e estoque 0.
 * O trigger `apply_purchase_to_inventory` (status → received) somará a quantidade
 * comprada ao estoque e recalculará o custo médio ponderado.
 *
 * Mutates the items in place, attaching `product_id` no draft resolvido.
 */
async function ensureProductsForItems(
  companyId: string,
  supplierId: string | null | undefined,
  items: PurchaseItemDraft[],
): Promise<PurchaseItemDraft[]> {
  const resolved: PurchaseItemDraft[] = [];
  for (const it of items) {
    if (it.product_id) {
      resolved.push(it);
      continue;
    }
    const name = (it.description ?? "").trim();
    if (!name) {
      resolved.push(it);
      continue;
    }
    const sku = (await generateNextSku(companyId, name)) ?? null;
    // Categoria: se a pessoa escolheu/editou uma na tela de revisão da
    // importação (it.category_name), isso tem prioridade — só cai pra
    // inferência automática por palavra-chave quando ela deixou em branco.
    let categoryId: string | null = null;
    try {
      const { ensureCategoryByName } = await import("@/features/categories/lib/ensure-category");
      const manualCategoryName = (it.category_name ?? "").trim();
      if (manualCategoryName) {
        categoryId = await ensureCategoryByName(companyId, manualCategoryName);
      } else {
        const { inferCategoryWithFallback } = await import("@/features/products/lib/infer-category");
        const { name: catName } = inferCategoryWithFallback(name);
        categoryId = await ensureCategoryByName(companyId, catName);
      }
    } catch {
      categoryId = null;
    }
    const { data: created, error } = await supabase
      .from("products")
      .insert({
        company_id: companyId,
        name,
        sku,
        supplier_id: supplierId ?? null,
        category_id: categoryId,
        cost: Number(it.unit_price) || 0,
        price: Number(it.unit_price) || 0,
        use_category_margin: false,
        stock: 0,
        status: "active",
      })
      .select("id,sku")
      .single();
    if (error) throw error;
    resolved.push({
      ...it,
      product_id: created.id,
      sku: created.sku ?? sku,
    });

  }
  return resolved;
}

/**
 * Compara os itens já gravados no banco com os que vieram do formulário,
 * ignorando ordem — usado só pra saber se uma edição numa compra "recebida"
 * REALMENTE mexeu nos itens (e por isso deve ser bloqueada) ou se é só uma
 * edição de campos do cabeçalho (frete, desconto, observações etc.), que
 * não tem por que ser bloqueada.
 */
function itemsMatchPersisted(
  current: { product_id: string | null; quantity: number; unit_price: number; discount: number | null }[],
  incoming: PurchaseItemDraft[],
): boolean {
  if (current.length !== incoming.length) return false;
  const cents = (v: number | null | undefined) => Math.round((Number(v) || 0) * 100);
  const key = (row: { product_id: string | null; quantity: number; unit_price: number; discount: number | null }) =>
    `${row.product_id ?? ""}|${cents(row.quantity)}|${cents(row.unit_price)}|${cents(row.discount)}`;
  const a = current.map(key).sort();
  const b = incoming
    .map((it) => key({ product_id: it.product_id ?? null, quantity: it.quantity, unit_price: it.unit_price, discount: it.discount }))
    .sort();
  return a.every((v, i) => v === b[i]);
}
// P1.2 — Validação server-side na criação de compras.
const purchaseItemSchema = z
  .object({
    product_id: z.string().uuid().nullable().optional(),
    description: z.string().trim().min(1, "Descrição do item é obrigatória."),
    quantity: z.number().positive("Quantidade deve ser maior que zero."),
    unit_price: z.number().nonnegative("Preço não pode ser negativo."),
  })
  .passthrough();

const purchaseCreateSchema = z
  .object({
    company_id: z.string().uuid("Empresa inválida."),
    supplier_id: z.string().uuid().nullable().optional(),
    status: z.string().trim().min(1).optional(),
    items: z.array(purchaseItemSchema).min(1, "Inclua ao menos um item na compra."),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    const status = String(val.status ?? "draft").toLowerCase();
    if (status !== "draft" && status !== "cancelled" && !val.supplier_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supplier_id"],
        message: "Selecione um fornecedor para registrar a compra.",
      });
    }
  });


type SupplierRef = { id: string; name: string } | null;

async function attachSupplierNames<T extends { supplier_id: string | null }>(
  rows: T[],
): Promise<Map<string, string>> {
  const ids = Array.from(
    new Set(rows.map((r) => r.supplier_id).filter((v): v is string => !!v)),
  );
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("product_suppliers")
    .select("id,name")
    .in("id", ids);
  if (error) throw error;
  const map = new Map<string, string>();
  (data ?? []).forEach((s) => map.set(s.id, s.name));
  return map;
}

export const purchasesService = {
  async list(companyId: string, filters: PurchaseListFilters) {
    let q = supabase
      .from("purchases")
      .select("*", { count: "exact" })
      .eq("company_id", companyId);

    if (filters.search.trim()) {
      const s = `%${filters.search.trim()}%`;
      q = q.or(`number.ilike.${s},notes.ilike.${s}`);
    }
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.supplierId) q = q.eq("supplier_id", filters.supplierId);

    q = q.order(filters.sortBy, { ascending: filters.sortDir === "asc" });

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0)
      return { rows: [] as PurchaseWithMeta[], total: count ?? 0 };

    const supplierMap = await attachSupplierNames(rows);

    const ids = rows.map((r) => r.id);
    const { data: items, error: ierr } = await supabase
      .from("purchase_items")
      .select("purchase_id")
      .in("purchase_id", ids);
    if (ierr) throw ierr;
    const counts = new Map<string, number>();
    (items ?? []).forEach((it) => {
      counts.set(it.purchase_id, (counts.get(it.purchase_id) ?? 0) + 1);
    });

    const withMeta: PurchaseWithMeta[] = rows.map((r) => ({
      ...r,
      supplier_name: r.supplier_id ? (supplierMap.get(r.supplier_id) ?? null) : null,
      items_count: counts.get(r.id) ?? 0,
    }));

    return { rows: withMeta, total: count ?? 0 };
  },

  async metrics(companyId: string) {
    const { data, error } = await supabase
      .from("purchases")
      .select("status,grand_total,purchase_date,supplier_id")
      .eq("company_id", companyId);
    if (error) throw error;

    const rows = data ?? [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthRows = rows.filter(
      (r) => r.purchase_date && new Date(r.purchase_date) >= startOfMonth,
    );

    const activeSuppliers = new Set(
      rows.filter((r) => r.supplier_id).map((r) => r.supplier_id),
    );

    return {
      monthCount: monthRows.length,
      monthTotal: monthRows.reduce((s, r) => s + Number(r.grand_total ?? 0), 0),
      pending: rows.filter((r) => r.status === "pending").length,
      activeSuppliers: activeSuppliers.size,
    };
  },

  async get(id: string): Promise<PurchaseWithItems | null> {
    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const { data: items, error: ierr } = await supabase
      .from("purchase_items")
      .select("*")
      .eq("purchase_id", id)
      .order("position", { ascending: true });
    if (ierr) throw ierr;

    let supplier_name: string | null = null;
    if (data.supplier_id) {
      const { data: sup } = await supabase
        .from("product_suppliers")
        .select("name")
        .eq("id", data.supplier_id)
        .maybeSingle();
      supplier_name = (sup as SupplierRef)?.name ?? null;
    }

    return { ...data, items: items ?? [], supplier_name };
  },

  async listActiveSuppliers(companyId: string) {
    const { data, error } = await supabase
      .from("product_suppliers")
      .select("id,name")
      .eq("company_id", companyId)
      .neq("status", "archived")
      .order("name")
      .limit(500);
    if (error) throw error;
    return data ?? [];
  },

  async create(
    input: Omit<PurchaseInsert, "items_total" | "grand_total"> & {
      items: PurchaseItemDraft[];
    },
  ) {
    const parsed = purchaseCreateSchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(parsed.error.issues.map((i) => i.message).join(" · "));
    }
    const { items: rawItems, ...header } = input;
    // Cria produtos automaticamente para linhas sem product_id (importação /
    // linha manual) antes de calcular totais e persistir.
    const items = await ensureProductsForItems(
      String(header.company_id),
      (header as { supplier_id?: string | null }).supplier_id ?? null,
      rawItems,
    );
    const totals = computeTotals(items, {
      discount: Number(header.discount ?? 0),
      shipping: Number(header.shipping ?? 0),
      insurance: Number(header.insurance ?? 0),
      other_costs: Number(header.other_costs ?? 0),
    });

    // O gatilho que dá entrada no estoque (apply_purchase_to_inventory) é
    // "AFTER UPDATE OF status" — ele só dispara numa TRANSIÇÃO de status via
    // UPDATE, nunca num INSERT. Se a compra já nascer com status "received"
    // (ex.: importar um pedido já recebido e salvar direto como Recebida),
    // o trigger nunca roda e o estoque fica travado em 0 pra sempre — sem
    // nenhum erro visível. Por isso criamos sempre como rascunho aqui, e se
    // o status pedido for outro, aplicamos DEPOIS pelo mesmo caminho da tela
    // de detalhe (setStatus/RPC receive_purchase), que faz a transição via
    // UPDATE de verdade e dispara o trigger corretamente.
    const requestedStatus = String((header as { status?: string }).status ?? "draft");

    const { data: created, error } = await supabase
      .from("purchases")
      .insert({ ...header, ...totals, status: "draft" })
      .select()
      .single();

    if (error) throw error;

    if (items.length > 0) {
      const rows = items.map((it, idx) => ({
        purchase_id: created.id,
        product_id: it.product_id,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount: it.discount,
        total: computeItemTotal(it),
        position: idx,
      }));
      const { error: ierr } = await supabase.from("purchase_items").insert(rows);
      if (ierr) throw ierr;
    }

    if (requestedStatus !== "draft") {
      return purchasesService.setStatus(created.id, requestedStatus);
    }

    return created;
  },

  async update(
    id: string,
    input: PurchaseUpdate & { items?: PurchaseItemDraft[] },
  ) {
    const { items: rawItems, ...header } = input;

    // Trava de integridade de estoque: uma vez "recebida", o gatilho que dá
    // entrada no estoque (apply_purchase_to_inventory) já rodou e só roda
    // uma vez (guardado por stock_applied). Editar os itens depois disso
    // deixaria a compra e o estoque real dessincronizados silenciosamente,
    // sem nenhum aviso — por isso bloqueamos aqui, na camada de serviço,
    // como segunda linha de defesa além do bloqueio na tela.
    if (rawItems) {
      const { data: currentStatus, error: statusErr } = await supabase
        .from("purchases")
        .select("status")
        .eq("id", id)
        .maybeSingle();
      if (statusErr) throw statusErr;
      if (currentStatus?.status === "received") {
        const { data: currentItemRows, error: itemsErr } = await supabase
          .from("purchase_items")
          .select("product_id,quantity,unit_price,discount")
          .eq("purchase_id", id);
        if (itemsErr) throw itemsErr;

        if (!itemsMatchPersisted(currentItemRows ?? [], rawItems)) {
          throw new Error(
            "Esta compra já foi recebida e o estoque já foi aplicado — os itens não podem mais ser editados. Use um ajuste de estoque para corrigir quantidades.",
          );
        }
      }
    }

    // Resolve produtos auto-criados apenas quando itens vieram no update.
    let items: PurchaseItemDraft[] | undefined = rawItems;
    if (rawItems && rawItems.some((it) => !it.product_id)) {
      const { data: existing, error: exErr } = await supabase
        .from("purchases")
        .select("company_id,supplier_id")
        .eq("id", id)
        .maybeSingle();
      if (exErr) throw exErr;
      const companyId =
        (header as { company_id?: string }).company_id ?? existing?.company_id;
      const supplierId =
        (header as { supplier_id?: string | null }).supplier_id ??
        existing?.supplier_id ??
        null;
      if (!companyId) throw new Error("Empresa não identificada para a compra.");
      items = await ensureProductsForItems(companyId, supplierId, rawItems);
    }

    let totalsPatch: { items_total?: number; grand_total?: number } = {};
    if (items) {
      const totals = computeTotals(items, {
        discount: Number(header.discount ?? 0),
        shipping: Number(header.shipping ?? 0),
        insurance: Number(header.insurance ?? 0),
        other_costs: Number(header.other_costs ?? 0),
      });
      totalsPatch = totals;
    }

    // PRED-001 — Garantimos que o status enviado pelo usuário seja preservado
    // e não sobrescrito por valores default ou mutações indesejadas.
    //
    // O gatilho apply_purchase_to_inventory dispara em "AFTER UPDATE OF
    // status" e lê os itens da compra NAQUELE exato momento. Se a troca de
    // status (p.ex. rascunho -> recebida) fosse gravada ANTES de sincronizar
    // os itens novos, o trigger rodaria com os itens antigos (ou nenhum, se
    // a compra ainda não tinha itens) — estoque errado ou zerado, do mesmo
    // jeito que em create(). Por isso: (1) o status sai do payload principal,
    // (2) os itens são sincronizados primeiro, (3) a troca de status é
    // aplicada por último, pelo mesmo caminho (setStatus/RPC
    // receive_purchase) usado na tela de detalhe.
    const requestedStatus = (header as { status?: string }).status;
    const headerWithoutStatus = { ...(header as PurchaseUpdate) };
    delete (headerWithoutStatus as { status?: string }).status;

    const updatePayload = {
      ...headerWithoutStatus,
      ...totalsPatch,
    };

    if (items) {
      const { error: delErr } = await supabase
        .from("purchase_items")
        .delete()
        .eq("purchase_id", id);
      if (delErr) throw delErr;

      if (items.length > 0) {
        const rows = items.map((it, idx) => ({
          purchase_id: id,
          product_id: it.product_id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount: it.discount,
          total: computeItemTotal(it),
          position: idx,
        }));
        const { error: ierr } = await supabase.from("purchase_items").insert(rows);
        if (ierr) throw ierr;
      }
    }

    let updated = await updateRow("purchases", id, updatePayload);

    if (requestedStatus !== undefined && requestedStatus !== updated.status) {
      updated = await purchasesService.setStatus(id, requestedStatus);
    }

    return updated;
  },


  async setStatus(id: string, status: string) {
    // CORRIGIDO (2026-09): esta função chamava a RPC `receive_purchase` pra
    // marcar como recebida, mas essa função não está acessível no banco
    // deste projeto agora — toda tentativa de salvar como "Recebida" falhava
    // com 404 em /rest/v1/rpc/receive_purchase (function not found no
    // PostgREST), mesmo a função existindo nas migrations do repositório —
    // ou o cache de schema do PostgREST está desatualizado, ou a migration
    // nunca rodou de fato no banco. De qualquer forma, isso travava 100% das
    // compras marcadas como recebidas (tanto novas quanto edições).
    //
    // Trocado por um UPDATE direto: quem realmente aplica o estoque é o
    // gatilho `trg_apply_purchase_to_inventory` (AFTER UPDATE OF status),
    // que existe desde 13/07/2026 e não depende de nenhuma RPC. Isso
    // pressupõe que os itens já têm product_id resolvido antes de receber —
    // o que create()/update() já garantem via ensureProductsForItems.
    const patch: PurchaseUpdate & { received_at?: string } = { status };
    if (status === "received") {
      patch.received_at = new Date().toISOString();
    }
    return updateRow("purchases", id, patch);
  },
  async reprocessReceipt(id: string) {
    const { data, error } = await supabase.rpc("reprocess_received_purchase", {
      _purchase_id: id,
    });
    if (error) throw error;
    return data;
  },



  async remove(id: string) {
    const { error } = await supabase.from("purchases").delete().eq("id", id);
    if (error) throw error;
  },
};
