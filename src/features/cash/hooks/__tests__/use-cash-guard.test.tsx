import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(cleanup);

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: { id: "u1", email: "a@b" } }),
}));
vi.mock("../../services/cash.service", () => ({
  cashService: { getOpenSession: async () => null },
}));
vi.mock("../../components/require-open-cash-dialog", () => ({
  RequireOpenCashDialog: (p: { open: boolean; onCancel: () => void; onOpenCash: () => void }) =>
    p.open ? (
      <div>
        <button onClick={p.onOpenCash}>abrir caixa</button>
        <button onClick={p.onCancel}>desistir</button>
      </div>
    ) : null,
}));
vi.mock("../../components/open-session-dialog", () => ({
  OpenSessionDialog: (p: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onOpened?: () => void;
  }) =>
    p.open ? (
      <button
        onClick={() => {
          p.onOpenChange(false);
          p.onOpened?.();
        }}
      >
        confirmar abertura
      </button>
    ) : null,
}));

import { useCashGuard } from "../use-cash-guard";

function Harness({
  action,
  onResult,
}: {
  action: () => Promise<string>;
  onResult: (r: unknown) => void;
}) {
  const { runWithCashGuard, cashGuardDialog } = useCashGuard({ companyId: "c" });
  return (
    <>
      <button onClick={async () => onResult(await runWithCashGuard(action))}>receber</button>
      {cashGuardDialog}
    </>
  );
}

describe("guarda de caixa", () => {
  it("depois de abrir o caixa, devolve o resultado para quem pediu (a tela fecha)", async () => {
    let calls = 0;
    const action = vi.fn(async () => {
      calls++;
      if (calls === 1) throw { message: "CAIXA_FECHADO: abra o caixa" };
      return "ok";
    });
    const onResult = vi.fn();
    render(<Harness action={action} onResult={onResult} />);
    fireEvent.click(screen.getByText("receber"));
    fireEvent.click(await screen.findByText("abrir caixa"));
    const confirm = await screen.findByText("confirmar abertura");
    await act(async () => {
      fireEvent.click(confirm);
      await new Promise((r) => setTimeout(r, 5));
    });
    expect(action).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenCalledWith("ok");
  });

  it("se desistir, devolve undefined e não repete", async () => {
    const action = vi.fn(async () => {
      throw { message: "CAIXA_FECHADO" };
    });
    const onResult = vi.fn();
    render(<Harness action={action} onResult={onResult} />);
    fireEvent.click(screen.getByText("receber"));
    const giveUp = await screen.findByText("desistir");
    await act(async () => {
      fireEvent.click(giveUp);
    });
    expect(onResult).toHaveBeenCalledWith(undefined);
    expect(action).toHaveBeenCalledTimes(1);
  });
});
