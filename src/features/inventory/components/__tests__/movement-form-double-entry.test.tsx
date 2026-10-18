import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

afterEach(cleanup);
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let purchaseRow: Record<string, unknown> | null = null;

function chain(result: () => unknown) {
  const q: any = {
    select: () => q,
    eq: () => q,
    gte: () => q,
    order: () => q,
    limit: () => q,
    or: () => q,
    maybeSingle: async () => ({ data: result(), error: null }),
    then: (res: (v: unknown) => unknown) =>
      res({
        data: [{ id: "p1", name: "Boné Nike", sku: "BON-1", unit: "UN", stock: 1, created_at: "" }],
        error: null,
      }),
  };
  return q;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (t: string) => chain(() => (t === "inventory_movements" ? purchaseRow : null)),
  },
}));
vi.mock("@/providers/auth-provider", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("../../hooks/use-inventory", () => ({
  useCreateMovement: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

async function renderDialog() {
  const { MovementFormDialog } = await import("../movement-form-dialog");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MovementFormDialog
        open
        onOpenChange={() => {}}
        companyId="c1"
        defaultProductId="p1"
        defaultType="in"
        lockProduct
      />
    </QueryClientProvider>,
  );
}

describe("entrada manual depois da compra", () => {
  it("avisa quando a peça já entrou por compra nos últimos dias", async () => {
    purchaseRow = {
      quantity: 1,
      reference_number: "PC-20260916-1110",
      movement_date: new Date().toISOString(),
    };
    await renderDialog();
    expect(await screen.findByText("Essa peça já entrou pela compra")).toBeTruthy();
    expect(screen.getByText(/PC-20260916-1110/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Registrar mesmo assim" })).toBeTruthy();
  });

  it("não avisa quando não houve compra recente", async () => {
    purchaseRow = null;
    await renderDialog();
    expect(await screen.findByRole("button", { name: "Registrar" })).toBeTruthy();
    expect(screen.queryByText("Essa peça já entrou pela compra")).toBeNull();
  });
});
