/**
 * Garante que o enum de ambiente usado pelo código é EXATAMENTE o mesmo
 * aceito pelas CHECK constraints do banco (declaradas nas migrations).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  FISCAL_ENVIRONMENTS,
  FISCAL_ENVIRONMENT_CONSTRAINTS,
  fiscalEnvironmentSchema,
  normalizeFiscalEnvironment,
} from "../environment";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

function migrationsSql(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
    .join("\n");
}

/** Última definição declarada para a constraint (a que vale no banco). */
function acceptedValues(constraint: string, sql: string): string[] | null {
  const re = new RegExp(
    `CONSTRAINT\\s+${constraint}\\s+CHECK\\s*\\(([\\s\\S]*?)\\)\\s*;`,
    "gi",
  );
  let last: string | null = null;
  for (const m of sql.matchAll(re)) last = m[1];
  if (!last) return null;
  return [...last.matchAll(/'([a-zA-Z_]+)'/g)].map((m) => m[1]);
}

describe("fiscal environment enum", () => {
  const sql = migrationsSql();

  it("é exatamente ['homologation', 'production']", () => {
    expect([...FISCAL_ENVIRONMENTS]).toEqual(["homologation", "production"]);
  });

  it.each(FISCAL_ENVIRONMENT_CONSTRAINTS)(
    "constraint %s aceita o mesmo conjunto do código",
    (constraint) => {
      const values = acceptedValues(constraint, sql);
      if (values === null) return; // constraint não declarada nas migrations locais
      expect([...values].sort()).toEqual([...FISCAL_ENVIRONMENTS].sort());
    },
  );

  it("não existe valor legado (homolog/homologacao/sandbox/test) nas migrations fiscais", () => {
    for (const constraint of FISCAL_ENVIRONMENT_CONSTRAINTS) {
      const values = acceptedValues(constraint, sql) ?? [];
      for (const v of values) {
        expect(["homolog", "homologacao", "sandbox", "test"]).not.toContain(v);
      }
    }
  });

  it("normaliza valores legados para o enum canônico", () => {
    expect(normalizeFiscalEnvironment("homolog")).toBe("homologation");
    expect(normalizeFiscalEnvironment("HOMOLOGATION")).toBe("homologation");
    expect(normalizeFiscalEnvironment(null)).toBe("homologation");
    expect(normalizeFiscalEnvironment("production")).toBe("production");
    expect(fiscalEnvironmentSchema.safeParse("homolog").success).toBe(false);
  });
});
