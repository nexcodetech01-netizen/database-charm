import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveAsaasCustomerId,
  __resetResolverInflight,
  type CustomerRepo,
  type AsaasCustomerGateway,
  type CustomerRow,
} from "../lib/customer-resolver";
import { isValidCPF, isValidCNPJ } from "@/lib/validators";

// CPF/CNPJ válidos para testes (dígitos verificadores corretos).
const VALID_CPF = "39053344705";
const VALID_CNPJ = "11222333000181";
const VALID_CPF_MASKED = "390.533.447-05";

function makeRow(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: "c1",
    name: "Cliente Teste",
    email: "c@x.com",
    document: VALID_CPF,
    phone: "11999998888",
    asaas_customer_id_sandbox: null,
    asaas_customer_id_production: null,
    ...overrides,
  };
}

function makeRepo(row: CustomerRow | null) {
  const saveMock = vi.fn(async () => {});
  const clearMock = vi.fn(async () => {});
  return {
    findById: vi.fn(async () => row),
    saveAsaasCustomerId: saveMock,
    clearAsaasCustomerId: clearMock,
    saveMock,
    clearMock,
  } satisfies CustomerRepo & {
    saveMock: ReturnType<typeof vi.fn>;
    clearMock: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
}

function makeGateway(opts: {
  createId?: string;
  findResult?: { id: string } | null;
  findError?: Error;
  createError?: Error;
} = {}) {
  const createMock = vi.fn(async () => {
    if (opts.createError) throw opts.createError;
    return { id: opts.createId ?? "cus_new" };
  });
  const findMock = vi.fn(async () => {
    if (opts.findError) throw opts.findError;
    return opts.findResult ?? null;
  });
  return {
    createCustomer: createMock,
    findByDocument: findMock,
    createMock,
    findMock,
  } satisfies AsaasCustomerGateway & {
    createMock: ReturnType<typeof vi.fn>;
    findMock: ReturnType<typeof vi.fn>;
  };
}

const prodValidator = (d: string) =>
  (d.length === 11 && isValidCPF(d)) || (d.length === 14 && isValidCNPJ(d));

describe("resolveAsaasCustomerId — Produção (integração)", () => {
  beforeEach(() => __resetResolverInflight());

  it("bloqueia cobrança sem customerId", async () => {
    await expect(
      resolveAsaasCustomerId({
        customerId: null,
        environment: "production",
        repo: makeRepo(null),
        gateway: makeGateway(),
      }),
    ).rejects.toThrow(/CPF\/CNPJ cadastrado/i);
  });

  it("rejeita CPF com dígitos verificadores inválidos (mesma regra do checkout)", async () => {
    const repo = makeRepo(makeRow({ document: "12345678900" }));
    const gateway = makeGateway();
    await expect(
      resolveAsaasCustomerId({
        customerId: "c1",
        environment: "production",
        repo,
        gateway,
        validateDocument: prodValidator,
      }),
    ).rejects.toThrow(/CPF.*válido|CNPJ.*válido/i);
    expect(gateway.createMock).not.toHaveBeenCalled();
    expect(gateway.findMock).not.toHaveBeenCalled();
  });

  it("aceita CPF mascarado normalizando para apenas dígitos", async () => {
    const repo = makeRepo(makeRow({ document: VALID_CPF_MASKED }));
    const gateway = makeGateway({ createId: "cus_prod_1" });
    const id = await resolveAsaasCustomerId({
      customerId: "c1",
      environment: "production",
      repo,
      gateway,
      validateDocument: prodValidator,
    });
    expect(id).toBe("cus_prod_1");
    expect(gateway.createMock).toHaveBeenCalledWith(
      expect.objectContaining({ cpfCnpj: VALID_CPF }),
    );
  });

  it("aceita CNPJ válido", async () => {
    const repo = makeRepo(makeRow({ document: VALID_CNPJ }));
    const gateway = makeGateway({ createId: "cus_prod_cnpj" });
    const id = await resolveAsaasCustomerId({
      customerId: "c1",
      environment: "production",
      repo,
      gateway,
      validateDocument: prodValidator,
    });
    expect(id).toBe("cus_prod_cnpj");
  });

  it("NÃO reutiliza id de sandbox em produção — cria novo", async () => {
    const repo = makeRepo(
      makeRow({
        asaas_customer_id_sandbox: "cus_sandbox_bad",
        asaas_customer_id_production: null,
      }),
    );
    const gateway = makeGateway({ createId: "cus_prod_new" });
    const id = await resolveAsaasCustomerId({
      customerId: "c1",
      environment: "production",
      repo,
      gateway,
      validateDocument: prodValidator,
    });
    expect(id).toBe("cus_prod_new");
    expect(repo.saveMock).toHaveBeenCalledWith("c1", "production", "cus_prod_new");
  });

  it("IDEMPOTÊNCIA REMOTA: reutiliza cliente existente via findByDocument sem criar", async () => {
    const repo = makeRepo(makeRow());
    const gateway = makeGateway({
      findResult: { id: "cus_existing_prod" },
    });
    const id = await resolveAsaasCustomerId({
      customerId: "c1",
      environment: "production",
      repo,
      gateway,
      validateDocument: prodValidator,
    });
    expect(id).toBe("cus_existing_prod");
    expect(gateway.findMock).toHaveBeenCalledWith(VALID_CPF, "c1");
    expect(gateway.createMock).not.toHaveBeenCalled();
    expect(repo.saveMock).toHaveBeenCalledWith(
      "c1",
      "production",
      "cus_existing_prod",
    );
  });

  it("IDEMPOTÊNCIA CONCORRENTE: 5 chamadas paralelas para o mesmo cliente criam apenas 1 vez", async () => {
    const repo = makeRepo(makeRow());
    const gateway = makeGateway({ createId: "cus_only_once" });
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        resolveAsaasCustomerId({
          customerId: "c1",
          environment: "production",
          repo,
          gateway,
          validateDocument: prodValidator,
        }),
      ),
    );
    expect(results.every((r) => r === "cus_only_once")).toBe(true);
    expect(gateway.createMock).toHaveBeenCalledTimes(1);
    expect(gateway.findMock).toHaveBeenCalledTimes(1);
    expect(repo.saveMock).toHaveBeenCalledTimes(1);
  });

  it("Se findByDocument falha, resolver continua e cria normalmente", async () => {
    const repo = makeRepo(makeRow());
    const gateway = makeGateway({
      findError: new Error("timeout"),
      createId: "cus_fallback",
    });
    const id = await resolveAsaasCustomerId({
      customerId: "c1",
      environment: "production",
      repo,
      gateway,
      validateDocument: prodValidator,
    });
    expect(id).toBe("cus_fallback");
    expect(gateway.createMock).toHaveBeenCalled();
  });

  it("Reutiliza id de produção quando já existe (não chama findByDocument nem create)", async () => {
    const repo = makeRepo(
      makeRow({ asaas_customer_id_production: "cus_prod_saved" }),
    );
    const gateway = makeGateway();
    const id = await resolveAsaasCustomerId({
      customerId: "c1",
      environment: "production",
      repo,
      gateway,
      validateDocument: prodValidator,
    });
    expect(id).toBe("cus_prod_saved");
    expect(gateway.findMock).not.toHaveBeenCalled();
    expect(gateway.createMock).not.toHaveBeenCalled();
  });
});
