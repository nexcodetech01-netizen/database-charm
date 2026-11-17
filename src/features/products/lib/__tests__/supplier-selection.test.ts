import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, select, eq, maybeSingle } = vi.hoisted(() => ({
  from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from },
}));
import { resolveProductSupplierId } from "../supplier-selection";

const companyId = "11111111-1111-4111-8111-111111111111";
const supplierId = "22222222-2222-4222-8222-222222222222";

describe("product supplier selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ select });
    select.mockReturnValue({ eq });
    eq.mockReturnValue({ eq, maybeSingle });
  });

  it.each([undefined, null, "", "   "])("sends NULL for an unselected supplier: %s", async (value) => {
    expect(await resolveProductSupplierId(companyId, value)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects malformed identifiers before querying", async () => {
    await expect(resolveProductSupplierId(companyId, "invalid-id")).rejects.toThrow("Fornecedor inválido");
    expect(from).not.toHaveBeenCalled();
  });

  it("preserves the real selected supplier ID and scopes the lookup to the company", async () => {
    maybeSingle.mockResolvedValue({ data: { id: supplierId }, error: null });
    expect(await resolveProductSupplierId(companyId, supplierId)).toBe(supplierId);
    expect(from).toHaveBeenCalledWith("product_suppliers");
    expect(eq).toHaveBeenCalledWith("id", supplierId);
    expect(eq).toHaveBeenCalledWith("company_id", companyId);
  });

  it("rejects a missing or other-company supplier instead of sending its UUID", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(resolveProductSupplierId(companyId, supplierId)).rejects.toThrow("Fornecedor não encontrado nesta empresa");
  });

  it("does not treat lookup failures as no selection", async () => {
    const error = new Error("Connection failed");
    maybeSingle.mockResolvedValue({ data: null, error });
    await expect(resolveProductSupplierId(companyId, supplierId)).rejects.toBe(error);
  });
});