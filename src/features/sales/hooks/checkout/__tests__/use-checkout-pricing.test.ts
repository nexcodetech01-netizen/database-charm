import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { useCheckoutPricing } from "../use-checkout-pricing";

const items = [{ product_id: "p1", unit_price: 100, quantity: 1, discount: 0, position: 0 }];
const cardConfig = { active: true, card_fee_percent: 2.88, max_installments: 3 } as never;

function params(overrides: Partial<Parameters<typeof useCheckoutPricing>[0]> = {}) {
  return {
    open: true,
    saleId: "sale-1",
    initialAmount: 100,
    method: "pix_manual" as const,
    installments: 1,
    pdvCashItems: items,
    cardPriceConfig: cardConfig,
    confirmed: false,
    confirmedRef: { current: false },
    showCompleted: false,
    ...overrides,
  };
}

const methodsSent = () => rpc.mock.calls.map((c) => c[1]._payment_method);

describe("useCheckoutPricing — taxa do cartão não fica gravada", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
  });

  it("fechar sem pagar depois de escolher crédito volta a venda ao preço à vista", async () => {
    const { result } = renderHook(() =>
      useCheckoutPricing(params({ saleId: "sale-a", method: "credit_card" })),
    );
    await waitFor(() => expect(methodsSent()).toEqual(["credit_card"]));

    await act(() => result.current.restoreCashPricing());
    expect(methodsSent()).toEqual(["credit_card", "pix_manual"]);
    expect(result.current.amount).toBe(100);
  });

  it("reabrir a mesma venda no PIX reaplica o preço à vista (checkout remontado)", async () => {
    const first = renderHook(() =>
      useCheckoutPricing(params({ saleId: "sale-b", method: "credit_card" })),
    );
    await waitFor(() => expect(methodsSent()).toEqual(["credit_card"]));
    first.unmount(); // PDV desmonta o checkout ao fechar

    renderHook(() => useCheckoutPricing(params({ saleId: "sale-b", method: "pix_manual" })));
    await waitFor(() => expect(methodsSent()).toEqual(["credit_card", "pix_manual"]));
  });

  it("não chama o banco à toa: venda nova aberta no PIX já está no preço à vista", async () => {
    const { result } = renderHook(() => useCheckoutPricing(params({ saleId: "sale-c" })));
    await act(() => result.current.restoreCashPricing());
    expect(rpc).not.toHaveBeenCalled();
  });
});
