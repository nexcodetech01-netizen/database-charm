import { describe, expect, it } from "vitest";
import { actionableCount, groupBySeverity, issueLink, type HealthIssue } from "../health";

const mk = (p: Partial<HealthIssue>): HealthIssue => ({
  code: "x",
  severity: "warning",
  title: "t",
  detail: "d",
  ref_type: "product",
  ref_id: "id1",
  ref_label: null,
  ...p,
});

describe("saúde do sistema", () => {
  it("ordena do mais grave para o menos grave", () => {
    const g = groupBySeverity([
      mk({ severity: "info" }),
      mk({ severity: "critical" }),
      mk({ severity: "warning" }),
    ]);
    expect(g.map((x) => x.severity)).toEqual(["critical", "warning", "info"]);
  });

  it("conta só o que pede ação", () => {
    expect(actionableCount([mk({ severity: "info" }), mk({ severity: "critical" })])).toBe(1);
  });

  it("monta o link de cada tipo", () => {
    expect(issueLink(mk({ ref_type: "sale", ref_id: "s1" }))).toBe("/vendas/s1");
    expect(issueLink(mk({ ref_type: "page", ref_id: null, ref_label: "/vendas" }))).toBe("/vendas");
    expect(issueLink(mk({ ref_type: "page", ref_id: null, ref_label: "x" }))).toBeNull();
    expect(issueLink(mk({ ref_type: "account", ref_id: "a" }))).toBe("/financeiro");
  });
});
