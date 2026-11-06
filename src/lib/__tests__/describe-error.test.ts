import { describe, expect, it } from "vitest";
import { errorText } from "../describe-error";

describe("errorText", () => {
  it("mostra a mensagem de Error e de objeto do Supabase", () => {
    expect(errorText(new Error("falhou"))).toBe("falhou");
    expect(errorText({ message: "trigger x", code: "P0001" }, "padrão")).toBe("trigger x (código P0001)");
  });
  it("usa o texto padrão (ou nada) quando não há motivo", () => {
    expect(errorText(null, "Tente de novo.")).toBe("Tente de novo.");
    expect(errorText({})).toBeUndefined();
  });
});
