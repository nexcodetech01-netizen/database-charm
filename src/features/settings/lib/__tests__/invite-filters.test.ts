import { describe, it, expect } from "vitest";
import { buildRevokeInviteFilter } from "../invite-filters";

describe("buildRevokeInviteFilter", () => {
  it("sempre inclui company_id no filtro (regressão do bug de segurança real)", () => {
    // Sem isso, revokeInvite podia afetar convite de outra empresa só
    // sabendo o UUID — a checagem de permissão não protegia a linha.
    const filter = buildRevokeInviteFilter("invite-1", "company-a");
    expect(filter).toEqual({
      id: "invite-1",
      company_id: "company-a",
      status: "pending",
    });
  });

  it("nunca deixa revogar um convite de outra empresa mesmo com o mesmo invite id", () => {
    const filterCompanyA = buildRevokeInviteFilter("invite-shared-id", "company-a");
    const filterCompanyB = buildRevokeInviteFilter("invite-shared-id", "company-b");
    expect(filterCompanyA.company_id).not.toBe(filterCompanyB.company_id);
  });

  it("só afeta convites pendentes", () => {
    const filter = buildRevokeInviteFilter("invite-1", "company-a");
    expect(filter.status).toBe("pending");
  });
});
