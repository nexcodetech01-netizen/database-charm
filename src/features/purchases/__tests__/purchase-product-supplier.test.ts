import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), lookup: vi.fn(), eq: vi.fn(), inserts: vi.fn(), sku: vi.fn(), category: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/features/products/lib/sku-generator", () => ({
  generateNextSku: mocks.sku, isSkuUniqueViolation: () => false, bumpSkuSuffix: vi.fn(),
}));
vi.mock("@/features/categories/lib/ensure-category", () => ({ ensureCategoryByName: mocks.category }));
vi.mock("@/features/products/lib/infer-category", () => ({ inferCategoryWithFallback: () => ({ name: "Clothes" }) }));
vi.mock("@/features/products/lib/parse-product-attributes", () => ({
  parseProductAttributes: () => ({ brand: null, model: null, color: null, size: null }),
}));

import { purchasesService } from "../services/purchases.service";

const companyId = "78bfccca-f3a5-4110-9983-13e073f3ba77";
const supplierId = "2eb61337-ca1f-4a9d-b4bb-49a3b0d54b73";
const item = { product_id: null, description: "Shirt", quantity: 1, unit_price: 10, discount: 0 };
const purchase = (id: string | null) => ({
  company_id: companyId, supplier_id: id, number: "PC-test", status: "draft",
  items: [{ ...item }, { ...item, description: "Second shirt" }],
});

describe("purchase-created product supplier validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sku.mockResolvedValue("SKU-1");
    mocks.category.mockResolvedValue(null);
    mocks.eq.mockReturnValue({ eq: mocks.eq, maybeSingle: mocks.lookup, not: () => ({ limit: async () => ({ data: [], error: null }) }) });
    mocks.from.mockImplementation((table: string) => ({
      select: () => ({ eq: mocks.eq }),
      insert: (payload: unknown) => {
        mocks.inserts(table, payload);
        const result = { data: { id: `${table}-1`, sku: "SKU-1" }, error: null };
        return { ...result, select: () => ({ single: async () => result }) };
      },
    }));
  });

  it("rejects the actual nonexistent UUID before creating any products", async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: null });
    await expect(purchasesService.create(purchase(supplierId) as any)).rejects.toThrow(supplierId);
    expect(mocks.inserts).not.toHaveBeenCalled();
    expect(mocks.sku).not.toHaveBeenCalled();
    expect(mocks.category).not.toHaveBeenCalled();
  });

  it("rejects a supplier outside the purchase company", async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: null });
    await expect(purchasesService.create(purchase(supplierId) as any)).rejects.toThrow("não pertence à empresa");
    expect(mocks.eq).toHaveBeenCalledWith("company_id", companyId);
    expect(mocks.eq).toHaveBeenCalledWith("id", supplierId);
    expect(mocks.inserts).not.toHaveBeenCalled();
  });

  it("uses the real supplier ID on every created product after a single lookup", async () => {
    mocks.lookup.mockResolvedValue({ data: { id: supplierId }, error: null });
    await purchasesService.create(purchase(supplierId) as any);
    const products = mocks.inserts.mock.calls.filter(([table]) => table === "products");
    expect(products).toHaveLength(2);
    for (const [, payload] of products) expect(payload.supplier_id).toBe(supplierId);
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
  });

  it("preserves NULL for a purchase with no supplier", async () => {
    await purchasesService.create(purchase(null) as any);
    const products = mocks.inserts.mock.calls.filter(([table]) => table === "products");
    expect(products).toHaveLength(2);
    for (const [, payload] of products) expect(payload.supplier_id).toBeNull();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("stops before writes when the supplier lookup fails", async () => {
    const error = { message: "Lookup failed" };
    mocks.lookup.mockResolvedValue({ data: null, error });
    await expect(purchasesService.create(purchase(supplierId) as any)).rejects.toBe(error);
    expect(mocks.inserts).not.toHaveBeenCalled();
  });
});