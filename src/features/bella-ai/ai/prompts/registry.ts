/**
 * Prompt Registry — Fase 1.
 *
 * Prompts são arquivos `.md` versionados no filename.
 * Carregados em build-time via `?raw` (Vite/Vitest suportam nativamente).
 * Nunca hardcoded em TS: qualquer edição vai direto no `.md`, com bump de
 * versão no filename para virar `v2` (regra §6.5 do blueprint).
 */
import systemV1 from "./system.v1.md?raw";
import commercialV1 from "./commercial.v1.md?raw";

export interface PromptEntry {
  readonly id: string;
  readonly version: string;
  readonly domain: "system" | "commercial";
  readonly body: string;
}

const REGISTRY: readonly PromptEntry[] = [
  { id: "system", version: "v1", domain: "system", body: systemV1 },
  {
    id: "commercial",
    version: "v1",
    domain: "commercial",
    body: commercialV1,
  },
];

export interface PromptRegistry {
  get(id: string, version?: string): PromptEntry;
  list(): readonly PromptEntry[];
  /** Compõe system + domínio numa string única (uso futuro pelo LLM). */
  assemble(domain: "commercial"): { readonly text: string; readonly versions: readonly string[] };
}

export function createPromptRegistry(
  entries: readonly PromptEntry[] = REGISTRY,
): PromptRegistry {
  return {
    get(id, version) {
      const found = entries.find(
        (e) => e.id === id && (version ? e.version === version : true),
      );
      if (!found) throw new Error(`prompt não registrado: ${id}@${version ?? "*"}`);
      return found;
    },
    list() {
      return entries;
    },
    assemble(domain) {
      const system = entries.find((e) => e.id === "system");
      const domainPrompt = entries.find((e) => e.id === domain);
      if (!system || !domainPrompt) {
        throw new Error(`prompts obrigatórios ausentes: system + ${domain}`);
      }
      return {
        text: `${system.body}\n\n---\n\n${domainPrompt.body}`,
        versions: [
          `system@${system.version}`,
          `${domainPrompt.id}@${domainPrompt.version}`,
        ],
      };
    },
  };
}

export const defaultPromptRegistry = createPromptRegistry();
