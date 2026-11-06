/** Regras puras do cadastro em grade (testáveis sem tela). */
export interface GridRow {
  key: string;
  brand: string;
  color: string;
  size: string;
  quantity: string;
}

export interface GridGroup {
  key: string;
  name: string;
  model: string;
  categoryId: string;
  cost: string;
  price: string;
  rows: GridRow[];
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyRow = (): GridRow => ({
  key: uid(),
  brand: "",
  color: "",
  size: "",
  quantity: "1",
});

export const emptyGroup = (): GridGroup => ({
  key: uid(),
  name: "",
  model: "",
  categoryId: "",
  cost: "",
  price: "",
  rows: [emptyRow()],
});

/** "23,90" / "R$ 1.234,50" / "23.9" → número. */
export function parseMoney(raw: string): number {
  const t = String(raw ?? "").trim();
  if (!t) return 0;
  const cleaned = t
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

const qtyOf = (r: GridRow) => Math.max(0, Math.round(Number(r.quantity) || 0));

/** Totais para o rodapé: produtos, peças e valor da compra (com frete). */
export function gridSummary(groups: GridGroup[], shipping: number) {
  let products = 0;
  let pieces = 0;
  let items = 0;
  for (const g of groups) {
    const cost = parseMoney(g.cost);
    for (const r of g.rows) {
      const q = qtyOf(r);
      if (q <= 0) continue;
      products++;
      pieces += q;
      items += q * cost;
    }
  }
  const total = Math.round((items + (shipping || 0)) * 100) / 100;
  return { products, pieces, items: Math.round(items * 100) / 100, total };
}

/** Mensagem do primeiro problema, ou null se está tudo certo. */
export function validateGroups(groups: GridGroup[]): string | null {
  for (const [i, g] of groups.entries()) {
    const n = i + 1;
    const filled = g.rows.filter((r) => qtyOf(r) > 0);
    if (filled.length === 0) continue;
    if (!g.name.trim()) return `Grupo ${n}: falta o nome.`;
    if (!g.categoryId) return `Grupo ${n}: escolha a categoria.`;
    if (parseMoney(g.price) <= 0) return `Grupo ${n}: falta o preço de venda.`;
    for (const r of filled) {
      if (!r.size.trim()) return `Grupo ${n}: falta o tamanho em uma linha.`;
    }
    const seen = new Set<string>();
    for (const r of filled) {
      const k = [r.brand, r.color, r.size].map((v) => v.trim().toLowerCase()).join("|");
      if (seen.has(k))
        return `Grupo ${n}: a mesma marca, cor e tamanho aparecem duas vezes — some as quantidades numa linha.`;
      seen.add(k);
    }
  }
  if (gridSummaryHasNothing(groups)) return "Preencha ao menos uma linha com quantidade.";
  return null;
}

function gridSummaryHasNothing(groups: GridGroup[]) {
  return !groups.some((g) => g.rows.some((r) => qtyOf(r) > 0));
}

/* ------------------------------------------------------------------ */
/* Execução (dependências injetadas para testar sem banco)             */
/* ------------------------------------------------------------------ */

export interface GridCreateDeps {
  /** Produto já cadastrado com esse nome/cor/tamanho (ou null). */
  findExisting: (q: { name: string; color: string; size: string }) => Promise<string | null>;
  generateSku: (fullName: string, categoryId: string) => Promise<string | null>;
  createProduct: (p: Record<string, unknown>) => Promise<{ id: string }>;
  createPurchase: (p: Record<string, unknown>) => Promise<unknown>;
  /** Desfaz os produtos criados nesta tentativa se algo falhar depois. */
  deleteProducts?: (ids: string[]) => Promise<void>;
  resolveSupplier: () => Promise<string | null>;
  buildName: (p: { name: string; brand?: string; color?: string; size?: string }) => string;
  describe: (p: { model?: string; color?: string; size?: string }) => string;
  onProgress?: (done: number, total: number) => void;
}

export interface GridCreateInput {
  companyId: string;
  groups: GridGroup[];
  withPurchase: boolean;
  shipping: number;
  purchaseDate: string;
  purchaseNumber: string;
}

export interface GridCreateResult {
  createdCount: number;
  reused: number;
  purchaseNumber: string | null;
}

export async function runGridCreate(
  input: GridCreateInput,
  deps: GridCreateDeps,
): Promise<GridCreateResult> {
  const items: {
    product_id: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
  }[] = [];
  let createdCount = 0;
  let reused = 0;
  const createdIds: string[] = [];
  const total = gridSummary(input.groups, 0).products;
  let done = 0;

  try {
  for (const g of input.groups) {
    const cost = parseMoney(g.cost);
    const price = parseMoney(g.price);
    for (const r of g.rows) {
      const qty = qtyOf(r);
      if (qty <= 0) continue;
      done++;
      deps.onProgress?.(done, total);
      const name = deps.buildName({ name: g.name, brand: r.brand });
      const variant = deps.describe({ model: g.model, color: r.color, size: r.size });
      const description = variant ? `${name} — ${variant}` : name;

      const existing = await deps.findExisting({
        name,
        color: r.color.trim(),
        size: r.size.trim(),
      });
      if (existing) {
        reused++;
        if (input.withPurchase) {
          items.push({
            product_id: existing,
            description,
            quantity: qty,
            unit_price: cost,
            discount: 0,
          });
        }
        continue;
      }

      const sku = await deps.generateSku(
        deps.buildName({ name: g.name, brand: r.brand, color: r.color, size: r.size }),
        g.categoryId,
      );
      const product = await deps.createProduct({
        company_id: input.companyId,
        name,
        brand: r.brand.trim() || null,
        model: g.model.trim() || null,
        color: r.color.trim() || null,
        size: r.size.trim() || null,
        category_id: g.categoryId || null,
        cost,
        price,
        sku: sku ?? undefined,
        barcode: "SEM GTIN",
        unit: "UN",
        status: "active",
        sales_channels: ["loja_fisica", "catalog"],
        // Com compra, o estoque entra quando a compra for recebida.
        stock: input.withPurchase ? 0 : qty,
      });
      createdCount++;
      createdIds.push(product.id);
      items.push({
        product_id: product.id,
        description,
        quantity: qty,
        unit_price: cost,
        discount: 0,
      });
    }
  }

  let purchaseNumber: string | null = null;
  if (input.withPurchase && items.length > 0) {
    const supplierId = await deps.resolveSupplier();
    purchaseNumber = input.purchaseNumber;
    await deps.createPurchase({
      company_id: input.companyId,
      number: purchaseNumber,
      supplier_id: supplierId,
      purchase_date: input.purchaseDate,
      // Pendente = comprada, aguardando chegar. Estoque e conta a pagar
      // entram ao marcar como recebida.
      status: "pending",
      discount: 0,
      shipping: input.shipping,
      insurance: 0,
      other_costs: 0,
      notes: "Lançada pelo cadastro em grade.",
      items,
    });
  }
  return { createdCount, reused, purchaseNumber };
  } catch (err) {
    // Tudo ou nada: sem isto, uma falha na compra deixava as peças
    // cadastradas e a próxima tentativa criava cópias.
    if (createdIds.length > 0 && deps.deleteProducts) {
      await deps.deleteProducts(createdIds).catch(() => undefined);
    }
    throw err;
  }
}
