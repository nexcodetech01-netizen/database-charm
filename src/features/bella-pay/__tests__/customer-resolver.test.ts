import { describe, expect, it, vi } from "vitest";
import {
  resolveAsaasCustomerId,
  type CustomerRepo,
  type AsaasCustomerGateway,
  type CustomerRow,
} from "../lib/customer-resolver";

function makeRepo(row: CustomerRow | null): CustomerRepo & {
  saveMock: ReturnType<typeof vi.fn>;
} {
  const saveMock = vi.fn(async () => {});
  return {
    findById: async () => row,
    saveAsaasCustomerId: saveMock,
    saveMock,
  } as CustomerRepo & { saveMock: ReturnType<typeof vi.fn> };
}

function makeGateway(
  id = "cus_new",
): AsaasCustomerGateway & { createMock: ReturnType<typeof vi.fn> } {
  const createMock = vi.fn(async () => ({ id }));
  return {
    createCustomer: createMock,
    createMock,
  } as AsaasCustomerGateway & { createMock: ReturnType<typeof vi.fn> };
}

describe("resolveAsaasCustomerId (P0-03 + P0-04 + ENV-SPLIT)", () => {
  it("bloqueia cobrança sem customerId (não cria com CPF fictício)", async () => {
    const repo = makeRepo(null);
    const gateway = makeGateway();
    await expect(
      resolveAsaasCustomerId({
        customerId: null,
        environment: "production",
        repo,
        gateway,
      }),
    ).rejects.toThrow(/CPF\/CNPJ cadastrado/i);
    expect(gateway.createMock).not.toHaveBeenCalled();
  });

  it("erro claro se cliente não existe", async () => {
    const repo = makeRepo(null);
    const gateway = makeGateway();
    await expect(
      resolveAsaasCustomerId({
        customerId: "abc",
        environment: "production",
        repo,
        gateway,
      }),
    ).rejects.toThrow(/não encontrado/i);
    expect(gateway.createMock).not.toHaveBeenCalled();
  });

  it("reutiliza id do ambiente atual (production)", async () => {
    const repo = makeRepo({
      id: "c1",
      name: "Cliente",
      email: null,
      document: "12345678900",
      phone: null,
      asaas_customer_id_sandbox: "cus_sandbox",
      asaas_customer_id_production: "cus_prod",
    });
    const gateway = makeGateway();
    const id = await resolveAsaasCustomerId({
      customerId: "c1",
      environment: "production",
      repo,
      gateway,
    });
    expect(id).toBe("cus_prod");
    expect(gateway.createMock).not.toHaveBeenCalled();
    expect(repo.saveMock).not.toHaveBeenCalled();
  });

  it("NÃO reutiliza id de sandbox quando ambiente é production", async () => {
    const repo = makeRepo({
      id: "c1",
      name: "Cliente",
      email: null,
      document: "12345678900",
      phone: null,
      asaas_customer_id_sandbox: "cus_sandbox",
      asaas_customer_id_production: null,
    });
    const gateway = makeGateway("cus_prod_new");
    const id = await resolveAsaasCustomerId({
      customerId: "c1",
      environment: "production",
      repo,
      gateway,
    });
    expect(id).toBe("cus_prod_new");
    expect(gateway.createMock).toHaveBeenCalled();
    expect(repo.saveMock).toHaveBeenCalledWith(
      "c1",
      "production",
      "cus_prod_new",
    );
  });

  it("cria e persiste id no ambiente correto quando ausente", async () => {
    const repo = makeRepo({
      id: "c1",
      name: "Cliente",
      email: "c@x.com",
      document: "12345678900",
      phone: "11999",
      asaas_customer_id_sandbox: null,
      asaas_customer_id_production: null,
    });
    const gateway = makeGateway("cus_created");
    const id = await resolveAsaasCustomerId({
      customerId: "c1",
      environment: "production",
      repo,
      gateway,
    });
    expect(id).toBe("cus_created");
    expect(gateway.createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Cliente",
        cpfCnpj: "12345678900",
        externalReference: "c1",
      }),
    );
    expect(repo.saveMock).toHaveBeenCalledWith(
      "c1",
      "production",
      "cus_created",
    );
  });
});
