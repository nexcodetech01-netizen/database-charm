import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const cand = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  sku: id.toUpperCase(),
  created_at: "2026-10-17",
  variant: "",
  hasPhoto: false,
  photoCount: 0,
  categoryId: "vest",
  categoryName: "Vestuário",
  brand: "Nike",
  color: "Preta",
  size: "GG",
  stock: 1,
  ...extra,
});

const attach = vi.fn(async () => 2);
vi.mock("../../lib/batch-photos.service", () => ({
  listPhotoCandidates: async () => [
    cand("c1", "Camiseta Nike — Preta GG"),
    cand("c2", "Camiseta Lacoste — Verde G", { brand: "Lacoste", color: "Verde", size: "G" }),
    cand("cabo", "Cabo USB Tipo-C", { categoryId: "acc", categoryName: "Acessórios" }),
    cand("foto", "Camiseta Tommy — Azul G", { hasPhoto: true, photoCount: 2 }),
  ],
  attachPhotosToProduct: (...a: unknown[]) => attach(...(a as [])),
}));
vi.mock("@tanstack/react-router", () => ({ Link: (p: { children: unknown }) => p.children }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);
globalThis.URL.createObjectURL = () => "blob:x";
globalThis.URL.revokeObjectURL = () => {};

async function renderWs() {
  const { BatchPhotosWorkspace } = await import("../batch-photos-workspace");
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <BatchPhotosWorkspace companyId="co" />
    </QueryClientProvider>,
  );
}

describe("Fotos por peça (fila)", () => {
  it("mostra só peças sem foto da categoria Vestuário e salva na peça certa", async () => {
    await renderWs();
    expect(await screen.findByRole("heading", { name: "Camiseta Lacoste — Verde G" })).toBeTruthy();
    expect(screen.queryByText("Cabo USB Tipo-C")).toBeNull();
    expect(screen.queryByText("Camiseta Tommy — Azul G")).toBeNull();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const f1 = new File(["a"], "frente.png", { type: "image/png" });
    const f2 = new File(["b"], "costas.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [f1, f2] } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar e próxima/ }));

    await waitFor(() => expect(attach).toHaveBeenCalledTimes(1));
    expect(attach.mock.calls[0][0]).toMatchObject({ productId: "c2", coverIndex: 0 });
    expect(await screen.findByRole("heading", { name: "Camiseta Nike — Preta GG" })).toBeTruthy();
  });
});
