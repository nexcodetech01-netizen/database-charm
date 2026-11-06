import { describe, expect, it } from "vitest";
import { cameraErrorMessage, createCodeDebouncer } from "../lib/debounce";

describe("leitura pela câmera", () => {
  it("ignora o mesmo código lido de novo em seguida", () => {
    const ok = createCodeDebouncer(2000);
    expect(ok("CAM-1", 0)).toBe(true);
    expect(ok("CAM-1", 500)).toBe(false);
    expect(ok("CAM-2", 600)).toBe(true);
    expect(ok("CAM-2", 3000)).toBe(true);
    expect(ok("  ", 4000)).toBe(false);
  });
  it("explica câmera bloqueada", () => {
    expect(cameraErrorMessage({ name: "NotAllowedError" })).toMatch(/bloqueada/);
    expect(cameraErrorMessage(new Error("x"))).toMatch(/Não foi possível/);
  });
});
