import { describe, expect, it } from "vitest";
import {
  FiscalSecretValidationError,
  InMemoryFiscalVault,
  assertWritable,
  requiresEnvironment,
  selectSecret,
  vaultKey,
} from "../secret-vault";

const COMPANY = "78bfccca-f3a5-4110-9983-13e073f3ba77";

const ref = (
  environment: "homologation" | "production" | null,
  kind: "provider_api_key" | "provider_admin_key" | "cert_password" | "csc_token" = "provider_api_key",
) => ({
  companyId: COMPANY,
  kind,
  ownerId: null,
  environment,
});

describe("fiscal secret vault — chave lógica por ambiente", () => {
  it("inclui o ambiente na chave de unicidade", () => {
    expect(vaultKey(ref("homologation"))).not.toBe(vaultKey(ref("production")));
  });

  it("trata owner_id/environment nulos como valores (NULLS NOT DISTINCT)", () => {
    expect(vaultKey(ref(null))).toBe(vaultKey(ref(null)));
  });

  it("exige ambiente para credenciais do provedor", () => {
    expect(requiresEnvironment("provider_api_key")).toBe(true);
    expect(requiresEnvironment("provider_admin_key")).toBe(true);
    expect(requiresEnvironment("cert_password")).toBe(false);
    expect(() => assertWritable(ref(null))).toThrow(FiscalSecretValidationError);
    expect(() => assertWritable(ref(null, "cert_password"))).not.toThrow();
  });
});

describe("coexistência homologação × produção", () => {
  it("armazena as duas credenciais simultaneamente", () => {
    const vault = new InMemoryFiscalVault();
    vault.setSecret(ref("production"), "PROD");
    vault.setSecret(ref("homologation"), "HOMOL");

    expect(vault.all()).toHaveLength(2);
    expect(vault.readSecret(ref("production"))).toBe("PROD");
    expect(vault.readSecret(ref("homologation"))).toBe("HOMOL");
  });

  it("leitura por ambiente nunca cai para o outro ambiente", () => {
    const vault = new InMemoryFiscalVault();
    vault.setSecret(ref("production"), "PROD");
    expect(vault.readSecret(ref("homologation"))).toBeNull();
    expect(vault.hasSecret(ref("homologation"))).toBe(false);
    expect(vault.hasSecret(ref("production"))).toBe(true);
  });

  it("troca de ambiente devolve a credencial correta", () => {
    const vault = new InMemoryFiscalVault();
    vault.setSecret(ref("production"), "PROD");
    vault.setSecret(ref("homologation"), "HOMOL");
    for (const env of ["homologation", "production", "homologation"] as const) {
      expect(vault.readSecret(ref(env))).toBe(env === "production" ? "PROD" : "HOMOL");
    }
  });
});

describe("atualização e exclusão isoladas", () => {
  it("atualizar um ambiente não afeta o outro", () => {
    const vault = new InMemoryFiscalVault();
    vault.setSecret(ref("production"), "PROD");
    vault.setSecret(ref("homologation"), "HOMOL-1");
    vault.setSecret(ref("homologation"), "HOMOL-2");

    expect(vault.all()).toHaveLength(2);
    expect(vault.readSecret(ref("homologation"))).toBe("HOMOL-2");
    expect(vault.readSecret(ref("production"))).toBe("PROD");
  });

  it("excluir um ambiente preserva o outro", () => {
    const vault = new InMemoryFiscalVault();
    vault.setSecret(ref("production"), "PROD");
    vault.setSecret(ref("homologation"), "HOMOL");

    vault.deleteSecret(ref("homologation"));
    expect(vault.readSecret(ref("homologation"))).toBeNull();
    expect(vault.readSecret(ref("production"))).toBe("PROD");
    expect(vault.all()).toHaveLength(1);
  });

  it("gravação é idempotente por chave lógica (delete + insert)", () => {
    const vault = new InMemoryFiscalVault();
    vault.setSecret(ref("production"), "PROD");
    vault.setSecret(ref("production"), "PROD");
    expect(vault.all()).toHaveLength(1);
  });
});

describe("segredos sem ambiente (certificado)", () => {
  it("cert_password convive com credenciais de provedor", () => {
    const vault = new InMemoryFiscalVault();
    const cert = { companyId: COMPANY, kind: "cert_password" as const, ownerId: "cert-1", environment: null };
    vault.setSecret(ref("production"), "PROD");
    vault.setSecret(ref("homologation"), "HOMOL");
    vault.setSecret(cert, "SENHA");

    expect(vault.all()).toHaveLength(3);
    expect(vault.readSecret(cert)).toBe("SENHA");
  });
});

describe("selectSecret — desempate por updated_at", () => {
  it("devolve o registro mais recente do ambiente pedido", () => {
    const rows = [
      { ...ref("homologation"), ciphertext: "OLD", updatedAt: 1 },
      { ...ref("homologation"), ciphertext: "NEW", updatedAt: 2 },
      { ...ref("production"), ciphertext: "PROD", updatedAt: 3 },
    ];
    expect(selectSecret(rows, ref("homologation"))?.ciphertext).toBe("NEW");
    expect(selectSecret(rows, ref("production"))?.ciphertext).toBe("PROD");
  });
});
