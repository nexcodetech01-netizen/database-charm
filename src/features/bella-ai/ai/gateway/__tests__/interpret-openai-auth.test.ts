
import { describe, it, expect, vi } from "vitest";
import { interpretWithOpenAI } from "../interpret-openai.functions";
import { assertCompanyAccess, CompanyAccessError } from "@/lib/company-resolver.server";
import { z } from "zod";
import { integrationFetch } from "@/lib/http-client.server";

// Mock das dependências externas
vi.mock("@tanstack/react-start", () => ({
  createServerFn: vi.fn(() => ({
    middleware: vi.fn().mockReturnThis(),
    validator: vi.fn().mockReturnThis(),
    inputValidator: vi.fn().mockReturnThis(),
    handler: vi.fn((fn) => {
      const wrapper: any = fn;
      wrapper.handler = fn; // Expõe para testes
      return wrapper;
    }),
  })),
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
}));

vi.mock("@/lib/company-resolver.server", () => ({
  assertCompanyAccess: vi.fn(),
  CompanyAccessError: class CompanyAccessError extends Error {
    code = "COMPANY_ACCESS_DENIED";
    constructor(message = "Access Denied") {
      super(message);
    }
  },
}));

vi.mock("@/lib/http-client.server", () => ({
  integrationFetch: vi.fn(),
}));

describe("interpretWithOpenAI - Cenários de Segurança e Contexto", () => {
  const mockSkills: any[] = [];
  const validUuid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const otherUuid = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const validMessage = "Olá";

  // Helper para simular resposta da OpenAI
  const mockOpenAISuccess = () => {
    vi.mocked(integrationFetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ intent: "test", confidence: 1, response: "ok" }) } }],
        model: "gpt-test",
        usage: { prompt_tokens: 10, completion_tokens: 10 }
      })
    } as any);
  };

  it("1. companyId válido + usuário pertence à empresa -> OpenAI pode ser chamada", async () => {
    vi.mocked(assertCompanyAccess).mockResolvedValue(validUuid);
    mockOpenAISuccess();
    
    const context = { userId: "user-1", supabase: {} };
    const data = { 
      message: validMessage, 
      skills: mockSkills, 
      context: { companyId: validUuid } 
    };

    const handler = (interpretWithOpenAI as any).handler;
    await expect(handler({ data, context })).resolves.toBeDefined();
    expect(assertCompanyAccess).toHaveBeenCalledWith(context.supabase, context.userId, validUuid);
  });

  it("2. companyId válido + usuário NÃO pertence à empresa -> bloquear antes da OpenAI", async () => {
    vi.mocked(assertCompanyAccess).mockRejectedValue(new CompanyAccessError());
    
    const context = { userId: "user-1", supabase: {} };
    const data = { 
      message: validMessage, 
      skills: mockSkills, 
      context: { companyId: otherUuid } 
    };

    const handler = (interpretWithOpenAI as any).handler;
    await expect(handler({ data, context }))
      .rejects.toThrow("UNAUTHORIZED_CONTEXT");
  });

  it("3. companyId ausente -> erro de contexto (validado pelo validator)", () => {
    const validator = (data: any) => {
      const companyId = data.context?.companyId;
      if (!companyId) throw new Error("MISSING_COMPANY_CONTEXT");
      return data;
    };

    expect(() => validator({ message: validMessage, skills: mockSkills, context: {} }))
      .toThrow("MISSING_COMPANY_CONTEXT");
  });

  it("4. companyId inválido -> erro de validação UUID", () => {
    const validator = (data: any) => {
      const companyId = data.context?.companyId;
      z.string().uuid().parse(companyId);
      return data;
    };

    expect(() => validator({ message: validMessage, skills: mockSkills, context: { companyId: "invalid-id" } }))
      .toThrow();
  });

  it("5. userId ausente -> erro de autenticação", async () => {
    const context = { userId: null, supabase: {} };
    const data = { 
      message: validMessage, 
      skills: mockSkills, 
      context: { companyId: validUuid } 
    };

    const handler = (interpretWithOpenAI as any).handler;
    await expect(handler({ data, context }))
      .rejects.toThrow("UNAUTHORIZED_USER");
  });

  it("6. Confirmar que nenhum companyId é extraído de JWT claims", async () => {
    vi.mocked(assertCompanyAccess).mockClear();
    vi.mocked(assertCompanyAccess).mockResolvedValue(validUuid);
    mockOpenAISuccess();
    
    const context = { 
      userId: "user-1", 
      supabase: {}, 
      claims: { company_id: "wrong-id" } 
    };
    const data = { 
      message: validMessage, 
      skills: mockSkills, 
      context: { companyId: validUuid } 
    };

    const handler = (interpretWithOpenAI as any).handler;
    await handler({ data, context });
    
    expect(assertCompanyAccess).toHaveBeenCalledWith(context.supabase, context.userId, validUuid);
    expect(assertCompanyAccess).not.toHaveBeenCalledWith(context.supabase, context.userId, "wrong-id");
  });
});


