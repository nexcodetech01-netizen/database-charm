import { describe, expect, it } from "vitest";
import { defaultPromptRegistry, createPromptRegistry } from "../ai/prompts";

describe("Prompt Registry", () => {
  it("lista os prompts obrigatórios (system + commercial) versionados", () => {
    const list = defaultPromptRegistry.list();
    const ids = list.map((p) => `${p.id}@${p.version}`);
    expect(ids).toContain("system@v1");
    expect(ids).toContain("commercial@v1");
  });

  it("recupera prompt por id + versão", () => {
    const sys = defaultPromptRegistry.get("system", "v1");
    expect(sys.body).toContain("Bella IA");
    expect(sys.body).toContain("read-only");
  });

  it("compõe system + commercial na ordem correta", () => {
    const assembled = defaultPromptRegistry.assemble("commercial");
    expect(assembled.text.indexOf("System Prompt")).toBeLessThan(
      assembled.text.indexOf("Commercial Domain"),
    );
    expect(assembled.versions).toEqual(["system@v1", "commercial@v1"]);
  });

  it("lança erro para prompt inexistente", () => {
    expect(() => defaultPromptRegistry.get("finance", "v1")).toThrow(
      /não registrado/,
    );
  });

  it("permite injeção de registry alternativo (para testes/roadmap)", () => {
    const custom = createPromptRegistry([
      { id: "system", version: "v9", domain: "system", body: "SYS" },
      { id: "commercial", version: "v9", domain: "commercial", body: "COM" },
    ]);
    expect(custom.assemble("commercial").text).toBe("SYS\n\n---\n\nCOM");
  });
});
