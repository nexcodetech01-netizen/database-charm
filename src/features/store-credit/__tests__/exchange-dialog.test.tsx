import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn(async () => ({}));
vi.mock("../hooks/use-store-credit", () => ({
  useCreateExchange: () => ({ mutateAsync, isPending: false }),
}));
vi.mock("@/features/returns", () => ({
  useReturnedQuantities: () => ({ data: new Map() }),
}));
vi.mock("@/features/sales/pdv/components/pdv-customer-select", () => ({
  PDVCustomerSelect: ({ onChange }: { onChange: (v: string) => void }) => (
    <button type="button" onClick={() => onChange("cli-1")}>
      escolher cliente
    </button>
  ),
}));

import { ExchangeDialog } from "../components/exchange-dialog";

const items = [
  {
    id: "i1",
    product_id: "p1",
    description: "Camiseta M",
    quantity: 1,
    unit_price: 99.9,
    total: 89.9,
  },
] as never;

describe("ExchangeDialog", () => {
  it("gera vale no valor pago da peça e exige cliente quando a venda não tem", async () => {
    render(
      <ExchangeDialog
        open
        onOpenChange={() => {}}
        companyId="c"
        saleId="s"
        saleNumber="VD-1"
        saleItems={items}
        saleCustomerId={null}
      />,
    );
    fireEvent.click(screen.getByLabelText("Trocar Camiseta M"));
    expect(screen.getAllByText(/89,90/).length).toBeGreaterThan(1);
    const confirm = screen.getByText("Confirmar troca").closest("button")!;
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByText("escolher cliente"));
    expect(confirm.hasAttribute("disabled")).toBe(false);
    fireEvent.click(confirm);
    await Promise.resolve();
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        saleId: "s",
        customerId: "cli-1",
        items: [expect.objectContaining({ sale_item_id: "i1", quantity: 1 })],
      }),
    );
  });
});
