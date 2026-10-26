import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULES, isModuleEnabled } from "../modules";

describe("módulos", () => {
  it("sem configuração fica tudo ligado; false desliga", () => {
    expect(isModuleEnabled(null, "fiscal")).toBe(true);
    expect(isModuleEnabled({}, "fiscal")).toBe(true);
    expect(isModuleEnabled({ fiscal: false }, "fiscal")).toBe(false);
    expect(isModuleEnabled({ fiscal: true }, "fiscal")).toBe(true);
  });

  it("cada item listado no módulo está marcado com esse módulo no menu", () => {
    const sidebar = readFileSync(resolve(__dirname, "../../../components/layout/app-sidebar.tsx"), "utf8");
    for (const m of MODULES) {
      for (const title of m.menuItems) {
        const line = sidebar.split("\n").find((l) => l.includes(`title: "${title}",`));
        expect(line, title).toBeDefined();
        expect(line, title).toContain(`module: "${m.key}"`);
      }
    }
  });
});
