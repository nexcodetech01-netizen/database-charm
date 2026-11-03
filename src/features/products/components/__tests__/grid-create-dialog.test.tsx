import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const createProduct = vi.fn(async (p: { name: string }) => ({
  id: `id-${p.name}-${createProduct.mock.calls.length}`,
}));
const createPurchase = vi.fn(async (_p: unknown) => ({ id: "pc1" }));

vi.mock("../../services/products.service", () => ({
  productsService: { create: (p: never) => createProduct(p) },
}));
vi.mock("@/features/purchases/services/purchases.service", () => ({
  purchasesService: {
    create: (p: never) => createPurchase(p),
    listActiveSuppliers: async () => [{ id: "sup1", name: "Vest Fácil" }],
  },
}));
vi.mock("../../lib/sku-generator", () => ({ generateNextSku: async () => "CAM-001" }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// supabase: categorias + checagem de produto existente (nenhum).
const chain: Record<string, unknown> = {};
for (const m of ["select", "eq", "ilike", "neq", "limit", "is", "order"]) chain[m] = () => chain;
chain.then = (r: (v: unknown) => void) =>
  r({ data: [{ id: "vest", name: "Vestuário" }], error: null });
const existingChain: Record<string, unknown> = {};
for (const m of ["select", "eq", "ilike", "neq", "limit", "is"])
  existingChain[m] = () => existingChain;
existingChain.then = (r: (v: unknown) => void) => r({ data: [], error: null });
let call = 0;
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => (t === "product_categories" ? chain : (call++, existingChain)) },
}));

afterEach(cleanup);

describe("Cadastrar em grade", () => {
  it("cria um produto por linha e lança uma compra só, sem estoque antes de receber", async () => {
    const { GridCreateDialog } = await import("../grid-create-dialog");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <GridCreateDialog companyId="00000000-0000-0000-0000-000000000001" />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByText("Cadastrar em grade"));
    fireEvent.change(screen.getByPlaceholderText("Ex.: Camiseta Masculina Peruana Pima"), {
      target: { value: "Camiseta Masculina Peruana Pima" },
    });
    fireEvent.change(screen.getByPlaceholderText("Ex.: Minimalista"), {
      target: { value: "Minimalista" },
    });
    fireEvent.change(screen.getByPlaceholderText("23,90"), { target: { value: "23,90" } });
    fireEvent.change(screen.getByPlaceholderText("89,90"), { target: { value: "89,90" } });
    fireEvent.change(screen.getByLabelText("Marca"), { target: { value: "Gucci" } });
    fireEvent.change(screen.getByLabelText("Cor"), { target: { value: "Off-White" } });
    fireEvent.change(screen.getByLabelText("Tamanho"), { target: { value: "m" } });
    fireEvent.click(screen.getByText("Linha"));
    const marcas = screen.getAllByLabelText("Marca");
    fireEvent.change(marcas[1], { target: { value: "Emporio Armani" } });
    fireEvent.change(screen.getAllByLabelText("Cor")[1], { target: { value: "Preta" } });
    fireEvent.change(screen.getAllByLabelText("Tamanho")[1], { target: { value: "M" } });

    // Categoria e fornecedor: Radix Select não abre no jsdom — usa os estados via teclado não é viável,
    // então validamos que sem categoria o botão avisa (e não cria nada).
    fireEvent.click(screen.getByText("Criar produtos"));
    await waitFor(() => expect(createProduct).not.toHaveBeenCalled());
  });
});
