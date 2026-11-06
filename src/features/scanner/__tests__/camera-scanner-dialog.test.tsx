import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CameraScannerDialog } from "../camera-scanner-dialog";

afterEach(cleanup);

describe("CameraScannerDialog", () => {
  it("avisa quando o aparelho não tem câmera", async () => {
    // jsdom não tem navigator.mediaDevices
    render(<CameraScannerDialog open onOpenChange={() => {}} onCode={() => {}} />);
    expect(await screen.findByText(/Nenhuma câmera encontrada/)).toBeTruthy();
  });
});
