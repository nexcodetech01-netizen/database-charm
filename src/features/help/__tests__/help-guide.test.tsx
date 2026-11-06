import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HelpGuide } from "../components/help-guide";

afterEach(cleanup);

describe("HelpGuide", () => {
  it("mostra as seções e filtra pela busca", () => {
    render(<HelpGuide />);
    expect(screen.getAllByText("Trocas e devoluções").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Buscar no guia"), { target: { value: "sangria" } });
    expect(screen.queryByRole("heading", { name: "Trocas e devoluções" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Caixa" })).toBeTruthy();
  });
});
