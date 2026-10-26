import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let status = "offline";
vi.mock("../../../services/print-bridge.registry", () => ({
  getPrintBridge: async () => ({
    health: async () => ({ status, version: "1.3.0", printers: 10 }),
  }),
}));

import { PrintBridgeStatus } from "../PrintBridgeStatus";

describe("PrintBridgeStatus", () => {
  it("desligado: mostra como ligar com os comandos", async () => {
    status = "offline";
    render(<PrintBridgeStatus />);
    expect(await screen.findByText("Desligado")).toBeTruthy();
    fireEvent.click(screen.getByText("Como ligar"));
    expect(screen.getByText("npm run dev")).toBeTruthy();
  });

  it("ligado: mostra impressoras encontradas", async () => {
    status = "online";
    render(<PrintBridgeStatus />);
    expect(await screen.findByText("Ligado")).toBeTruthy();
    expect(screen.getByText(/10 impressoras encontradas/)).toBeTruthy();
  });
});
