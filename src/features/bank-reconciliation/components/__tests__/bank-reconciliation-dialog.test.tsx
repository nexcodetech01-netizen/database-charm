import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { BankReconciliationDialog } from "../bank-reconciliation-dialog";

const mocks = vi.hoisted(() => ({
  addMark: vi.fn().mockResolvedValue(undefined),
  extract: vi.fn().mockResolvedValue([
    ["01 DE OUTUBRO DE 2026", "a", "09 DE OUTUBRO DE 2026"],
    ["Saldo inicial", "0,00"],
    ["Saldo final do período", "10,00"],
    ["Movimentações"],
    ["09 OUT 2026", "Total de entradas", "10,00"],
    ["Pix recebido", "Cliente", "10,00"],
  ]),
}));

vi.mock("../../lib/pdf-rows", () => ({ extractPdfRows: mocks.extract }));
vi.mock("@/features/finance", () => ({
  useAccounts: () => ({ data: [{ id: "account-1", name: "Nubank PJ", type: "bank", status: "active", current_balance: 0 }] }),
  useFinancialCategories: () => ({ data: [] }),
  financeService: { listAccounts: vi.fn().mockResolvedValue([{ id: "account-1", current_balance: 0 }]) },
}));
vi.mock("../../services/bank-reconciliation.service", () => ({
  addDays: (day: string) => day,
  bankReconciliationService: {
    loadMoves: vi.fn().mockResolvedValue([]),
    loadLines: vi.fn().mockResolvedValue([]),
    lastMark: vi.fn().mockResolvedValue(null),
    addMark: mocks.addMark,
  },
}));
vi.mock("../launch-entry-dialog", () => ({ LaunchEntryDialog: () => null }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (value: string) => void }) => (
    <select aria-label="Conta" value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
}));

afterEach(() => cleanup());

it("allows marking the statement period even with pending entries and stores both balances", async () => {
  const onOpenChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const { container } = render(
    <QueryClientProvider client={qc}>
      <BankReconciliationDialog companyId="company-1" open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "Conta" }), { target: { value: "account-1" } });
  const fileInput = document.querySelector('input[type="file"]');
  if (!(fileInput instanceof HTMLInputElement)) throw new Error("File input missing");
  fireEvent.change(fileInput, { target: { files: [new File(["PDF"], "extrato.pdf", { type: "application/pdf" })] } });
  fireEvent.click(screen.getByRole("button", { name: "Ler extrato" }));
  await screen.findByText("Cliente");
  expect(mocks.extract).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Marcar conferido até 09/10/2026" }));
  await waitFor(() => expect(mocks.addMark).toHaveBeenCalledWith({
    companyId: "company-1", accountId: "account-1", reconciledUntil: "2026-10-09",
    statementBalance: 10, systemBalance: 0,
  }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
  qc.clear();
});