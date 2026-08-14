/**
 * fetchUserPermissions · fallback para membro de equipe sem "empresa
 * atual" definida.
 *
 * Bug real (2026-08-14, auditoria de RBAC): a função só caía pro
 * fallback de current_company_id → owner_id, pulando user_roles. Um
 * membro de equipe (não dono) sem current_company_id definido no perfil
 * (ex.: convite recém-aceito) ficava com companyId=null e, portanto,
 * ZERO permissões — mesmo tendo vínculo real e permissões concedidas.
 * Mesma classe de bug já corrigida em 6 telas de Configurações; aqui o
 * impacto é maior por afetar o próprio sistema de autorização.
 */
import { describe, it, expect, vi } from "vitest";

type Scenario = {
  profileCompanyId: string | null;
  membershipCompanyId: string | null;
  ownedCompanyId: string | null;
  isOwnerOfResolvedCompany: boolean;
  roleCodes: string[];
};

function buildSupabaseMock(scenario: Scenario) {
  return {
    from(table: string) {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { current_company_id: scenario.profileCompanyId },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "companies") {
        return {
          select: () => ({
            eq: (col: string, value: string) => {
              const chain = {
                eq: (col2: string) => ({
                  maybeSingle: async () => ({
                    data:
                      scenario.isOwnerOfResolvedCompany && col2 === "owner_id"
                        ? { id: value }
                        : null,
                    error: null,
                  }),
                }),
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: scenario.ownedCompanyId ? { id: scenario.ownedCompanyId } : null,
                      error: null,
                    }),
                  }),
                }),
                maybeSingle: async () => ({
                  data:
                    scenario.isOwnerOfResolvedCompany && col === "id"
                      ? { id: value }
                      : null,
                  error: null,
                }),
              };
              return chain;
            },
          }),
        };
      }
      if (table === "user_roles") {
        return {
          select: (cols: string) => ({
            eq: (_col1: string, _v1: string) => {
              // Chamada de fallback (busca companyId via vínculo): usa not().limit().maybeSingle()
              if (cols === "company_id") {
                return {
                  not: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: scenario.membershipCompanyId
                          ? { company_id: scenario.membershipCompanyId }
                          : null,
                        error: null,
                      }),
                    }),
                  }),
                };
              }
              // Chamada de permissões efetivas: .eq(user_id).eq(company_id)
              return {
                eq: async () => ({
                  data: scenario.roleCodes.map((code) => ({
                    role: { role_permissions: [{ permissions: { code } }] },
                  })),
                  error: null,
                }),
              };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return (globalThis as any).__supabaseMock;
  },
}));

import { fetchUserPermissions } from "../fetch-permissions";

describe("fetchUserPermissions", () => {
  it("membro de equipe sem current_company_id resolve via user_roles (regressão do bug real)", async () => {
    (globalThis as any).__supabaseMock = buildSupabaseMock({
      profileCompanyId: null,
      membershipCompanyId: "company-b",
      ownedCompanyId: null,
      isOwnerOfResolvedCompany: false,
      roleCodes: ["sales.view", "finance.view"],
    });

    const result = await fetchUserPermissions("user-1");

    expect(result.companyId).toBe("company-b");
    expect(result.isOwner).toBe(false);
    expect(result.permissions.has("sales.view")).toBe(true);
    expect(result.permissions.has("finance.view")).toBe(true);
  });

  it("sem current_company_id nem vínculo de equipe, cai pro fallback de dono", async () => {
    (globalThis as any).__supabaseMock = buildSupabaseMock({
      profileCompanyId: null,
      membershipCompanyId: null,
      ownedCompanyId: "company-owned",
      isOwnerOfResolvedCompany: true,
      roleCodes: [],
    });

    const result = await fetchUserPermissions("user-1");

    expect(result.companyId).toBe("company-owned");
    expect(result.isOwner).toBe(true);
    expect(result.permissions.has("*")).toBe(true);
  });

  it("com current_company_id definido, usa ele diretamente (comportamento já existente preservado)", async () => {
    (globalThis as any).__supabaseMock = buildSupabaseMock({
      profileCompanyId: "company-preferred",
      membershipCompanyId: "company-other",
      ownedCompanyId: null,
      isOwnerOfResolvedCompany: false,
      roleCodes: ["inventory.view"],
    });

    const result = await fetchUserPermissions("user-1");

    expect(result.companyId).toBe("company-preferred");
  });
});
