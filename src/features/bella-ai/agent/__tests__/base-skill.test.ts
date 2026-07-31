import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineBaseSkill } from "../infrastructure/base-skill";
import { buildExecutionContext } from "../infrastructure/context";

function ctxWith(perms: string[], isOwner = false) {
  return buildExecutionContext({
    companyId: "c1",
    userId: "u1",
    permissions: new Set(perms),
    isOwner,
    channel: "debug",
  });
}

describe("defineBaseSkill", () => {
  const schema = z.object({ name: z.string().min(1) }).strict();

  it("rejeita schema não-strict", () => {
    expect(() =>
      defineBaseSkill({
        id: "test.loose",
        name: "loose",
        module: "customer",
        description: "",
        schema: z.object({ name: z.string() }),
        requiredPermissions: ["customers.view"],
        handler: async () => ({ ok: true, code: "success", message: "ok" }),
      }),
    ).toThrow(/strict/i);
  });

  it("bloqueia sem permissão", async () => {
    const skill = defineBaseSkill({
      id: "test.ok",
      name: "ok",
      module: "customer",
      description: "",
      schema,
      requiredPermissions: ["customers.view"],
      handler: async () => ({ ok: true, code: "success", message: "ok" }),
    });
    const res = await skill.run({ payload: { name: "x" }, ctx: ctxWith([]) });
    expect(res.code).toBe("not_allowed");
  });

  it("owner sempre passa e handler executa", async () => {
    const skill = defineBaseSkill({
      id: "test.ok2",
      name: "ok2",
      module: "customer",
      description: "",
      schema,
      requiredPermissions: ["customers.view"],
      handler: async (input) => ({ ok: true, code: "success", message: `hi ${input.name}` }),
    });
    const res = await skill.run({ payload: { name: "Ana" }, ctx: ctxWith([], true) });
    expect(res.ok).toBe(true);
    expect(res.message).toBe("hi Ana");
  });

  it("payload inválido devolve missing_fields", async () => {
    const skill = defineBaseSkill({
      id: "test.invalid",
      name: "invalid",
      module: "customer",
      description: "",
      schema,
      requiredPermissions: ["customers.view"],
      handler: async () => ({ ok: true, code: "success", message: "ok" }),
    });
    const res = await skill.run({ payload: { foo: "bar" }, ctx: ctxWith([], true) });
    expect(res.code).toBe("missing_fields");
  });

  it("destructive exige confirmed=true", async () => {
    const skill = defineBaseSkill({
      id: "test.destr",
      name: "destr",
      module: "customer",
      description: "",
      schema,
      requiredPermissions: ["customers.view"],
      destructive: true,
      confirmationSummary: (i) => `apagar ${i.name}?`,
      handler: async () => ({ ok: true, code: "success", message: "deleted" }),
    });
    const first = await skill.run({ payload: { name: "X" }, ctx: ctxWith([], true) });
    expect(first.ok).toBe(false);
    expect(first.message).toMatch(/apagar X/);

    const second = await skill.run({
      payload: { name: "X" },
      ctx: ctxWith([], true),
      confirmed: true,
    });
    expect(second.ok).toBe(true);
  });
});
