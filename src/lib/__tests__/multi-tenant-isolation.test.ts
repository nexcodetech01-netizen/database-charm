/**
 * RC.0.2 — Guarda estática de isolamento multiempresa.
 *
 * Nenhum arquivo de servidor pode derivar autorização diretamente de
 * `profiles.current_company_id`. A única leitura permitida está no
 * resolver oficial, que revalida o vínculo real logo em seguida.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");

/** Arquivos autorizados a ler `current_company_id`. */
const ALLOWLIST = [
  join("src", "lib", "company-resolver.server.ts"),
  join("src", "features", "onboarding"),
  join("src", "hooks"),
  join("src", "components"),
  join("src", "routes"),
  join("src", "integrations", "supabase", "types.ts"),
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) acc.push(full);
  }
  return acc;
}

describe("RC.0.2 — isolamento multiempresa (estático)", () => {
  it("nenhum server function/serviço lê current_company_id fora do resolver", () => {
    const offenders = walk(SRC)
      .filter((file) => /\.server\.ts$|\.functions\.ts$|\.service\.ts$/.test(file))
      .filter((file) => !ALLOWLIST.some((allowed) => file.includes(allowed)))
      .filter((file) => readFileSync(file, "utf8").includes("current_company_id"));

    expect(offenders).toEqual([]);
  });
});
