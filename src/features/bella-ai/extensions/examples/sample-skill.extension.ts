/**
 * Exemplo: Skill registrada via SDK.
 * A Skill não implementa regra de negócio — apenas mostra a assinatura.
 */
import type { Extension } from "../types";
import { defineManifest } from "../ExtensionManifest";
import type { BellaSkill } from "../../skills/types";
import { skillResult } from "../../skills/types";

const echoSkill: BellaSkill = {
  id: "example.skill.echo",
  name: "Echo (exemplo)",
  description: "Devolve o texto informado — apenas para demonstrar o SDK.",
  module: "bella" as never,
  canExecute: () => true,
  execute: async (payload) => {
    const text = typeof payload.text === "string" ? payload.text : "";
    if (!text) {
      return skillResult.missing("Informe o texto.", [
        { field: "text", label: "Texto", type: "text", required: true },
      ]);
    }
    return skillResult.success("Texto ecoado.", { echoed: text });
  },
};

export const sampleSkillExtension: Extension = {
  manifest: defineManifest({
    id: "example.skill",
    name: "Skill de Exemplo",
    version: "1.0.0",
    author: "NexOS",
    description: "Registra a Skill echo via SDK.",
    permissions: ["execute"],
    compatibility: { minCore: "1.0.0" },
    enabled: true,
  }),
  register(api) {
    api.registerSkill(echoSkill as unknown as BellaSkill);
  },
};
