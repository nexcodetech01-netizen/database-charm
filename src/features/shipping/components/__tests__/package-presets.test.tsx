import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const q: any = {
        select: () => q,
        eq: () => q,
        order: async () => ({ data: null, error: { message: "relation does not exist" } }),
      };
      return q;
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(cleanup);

import { PackagePresetBar, presetToValues, DEFAULT_PRESETS, weightLabel } from "../package-presets";

describe("pacotes salvos", () => {
  it("mostra as sugestões mesmo sem a tabela e aplica as medidas no clique", async () => {
    const onApply = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <PackagePresetBar
          companyId="co"
          current={{ format: "1", peso_kg: "1", altura_cm: "2", largura_cm: "16", comprimento_cm: "20" }}
          onApply={onApply}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Envelope camiseta/ }));
    expect(onApply).toHaveBeenCalledWith({
      format: "3",
      peso_kg: "0,3",
      altura_cm: "2",
      largura_cm: "25",
      comprimento_cm: "32",
    });
  });

  it("formata faixas de peso como na SuperFrete", () => {
    expect(weightLabel(0.3)).toBe("Até 300 g");
    expect(weightLabel(1)).toBe("Até 1 kg");
    expect(presetToValues(DEFAULT_PRESETS[1]).peso_kg).toBe("1");
  });
});
