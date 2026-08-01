/**
 * RC.0.2 — Multi-Tenant Hardening.
 *
 * Garante que a resolução de empresa NUNCA confia em
 * `profiles.current_company_id` isoladamente: o vínculo real
 * (`companies.owner_id` ou `user_roles`) é sempre revalidado.
 */
import { describe, it, expect } from "vitest";
import {
  resolveCompanyId,
  assertCompanyAccess,
  userHasCompanyAccess,
  CompanyAccessError,
} from "@/lib/company-resolver.server";

const USER_A = "11111111-1111-1111-1111-111111111111";
const COMPANY_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const COMPANY_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

type Row = Record<string, unknown> | null;

interface FakeDb {
  profile?: Row;
  /** company_id => owner_id */
  companies?: Record<string, string>;
  /** `${userId}:${companyId}` */
  memberships?: string[];
}

/** Stub mínimo do query-builder do supabase-js usado pelo resolver. */
function makeSupabase(db: FakeDb) {
  const companies = db.companies ?? {};
  const memberships = new Set(db.memberships ?? []);

  return {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (col: string, value: unknown) => {
          filters[col] = value;
          return builder;
        },
        not: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => {
          if (table === "profiles") return { data: db.profile ?? null, error: null };

          if (table === "companies") {
            const owner = filters.owner_id as string | undefined;
            const id = filters.id as string | undefined;
            const match = Object.entries(companies).find(
              ([companyId, ownerId]) =>
                (id === undefined || companyId === id) &&
                (owner === undefined || ownerId === owner),
            );
            return { data: match ? { id: match[0] } : null, error: null };
          }

          if (table === "user_roles") {
            const userId = filters.user_id as string;
            const companyId = filters.company_id as string | undefined;
            const hit = [...memberships].find((entry) => {
              const [u, c] = entry.split(":");
              return u === userId && (companyId === undefined || c === companyId);
            });
            return {
              data: hit ? { company_id: hit.split(":")[1] } : null,
              error: null,
            };
          }

          return { data: null, error: null };
        },
      };
      return builder;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("RC.0.2 — company resolver hardening", () => {
  it("ignora current_company_id apontando para empresa sem vínculo", async () => {
    const supabase = makeSupabase({
      profile: { current_company_id: COMPANY_B }, // usuário adulterou a preferência
      companies: { [COMPANY_A]: USER_A },
      memberships: [`${USER_A}:${COMPANY_A}`],
    });

    await expect(resolveCompanyId(supabase, USER_A)).resolves.toBe(COMPANY_A);
  });

  it("aceita current_company_id quando existe vínculo real", async () => {
    const supabase = makeSupabase({
      profile: { current_company_id: COMPANY_A },
      companies: { [COMPANY_A]: USER_A },
      memberships: [`${USER_A}:${COMPANY_A}`],
    });

    await expect(resolveCompanyId(supabase, USER_A)).resolves.toBe(COMPANY_A);
  });

  it("falha quando o usuário não possui nenhuma empresa vinculada", async () => {
    const supabase = makeSupabase({ profile: { current_company_id: COMPANY_B } });
    await expect(resolveCompanyId(supabase, USER_A)).rejects.toThrow(/Empresa não configurada/);
  });

  it("userHasCompanyAccess reconhece owner e membership, recusa terceiros", async () => {
    const supabase = makeSupabase({
      companies: { [COMPANY_A]: USER_A },
      memberships: [`${USER_A}:${COMPANY_A}`],
    });

    await expect(userHasCompanyAccess(supabase, USER_A, COMPANY_A)).resolves.toBe(true);
    await expect(userHasCompanyAccess(supabase, USER_A, COMPANY_B)).resolves.toBe(false);
  });

  it("assertCompanyAccess bloqueia acesso cross-tenant", async () => {
    const supabase = makeSupabase({
      companies: { [COMPANY_A]: USER_A },
      memberships: [`${USER_A}:${COMPANY_A}`],
    });

    await expect(assertCompanyAccess(supabase, USER_A, COMPANY_A)).resolves.toBe(COMPANY_A);
    await expect(assertCompanyAccess(supabase, USER_A, COMPANY_B)).rejects.toBeInstanceOf(
      CompanyAccessError,
    );
  });
});
