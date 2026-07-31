/**
 * Resolvedor de Asaas Customer ID (P0-03 + P0-04 + ENV-SPLIT + IDEMPOTENCY).
 *
 * Regras:
 *  - `customerId` obrigatório (P0-04: proibido usar CPF fictício).
 *  - `customers.document` obrigatório, com dígitos verificadores válidos
 *    (CPF 11 dígitos ou CNPJ 14 dígitos). A validação é injetada para
 *    manter consistência com o mesmo validador usado no checkout.
 *  - IDs Asaas são segregados por ambiente (`sandbox` vs `production`). Um ID
 *    criado no Sandbox NÃO é válido em Produção — reutilizá-lo faz o Asaas
 *    responder "Customer inválido ou não informado". Por isso lemos e
 *    gravamos por coluna específica do ambiente.
 *  - Se `customers.asaas_customer_id_<env>` já existir, reutiliza (dedupe) e
 *    faz um POST idempotente para garantir CPF atual.
 *  - Se NÃO existir localmente, tenta primeiro reutilizar via
 *    `GET /customers?cpfCnpj=<digits>` (idempotência remota) antes de criar,
 *    evitando duplicação por retries ou chamadas concorrentes.
 *  - Chamadas concorrentes para o mesmo (customerId, environment) são
 *    deduplicadas por um cache in-flight de Promises.
 *
 * As dependências (repo/gateway) são injetadas para permitir teste unitário
 * sem tocar Supabase nem a rede.
 */

export type AsaasEnv = "sandbox" | "production";

export interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  document: string | null;
  phone: string | null;
  asaas_customer_id_sandbox: string | null;
  asaas_customer_id_production: string | null;
}

export interface AsaasCustomerGateway {
  createCustomer(input: {
    name: string;
    email?: string;
    cpfCnpj?: string;
    phone?: string;
    externalReference?: string;
  }): Promise<{ id: string }>;
  updateCustomer?(
    asaasCustomerId: string,
    input: {
      name?: string;
      email?: string;
      cpfCnpj?: string;
      phone?: string;
    },
  ): Promise<{ id: string }>;
  /**
   * IDEMPOTENCY: busca cliente no Asaas por CPF/CNPJ antes de criar.
   * Retorna o melhor match (preferindo externalReference igual ao id local).
   */
  findByDocument?(
    cpfCnpj: string,
    externalReference?: string,
  ): Promise<{ id: string } | null>;
}

export interface CustomerRepo {
  findById(id: string): Promise<CustomerRow | null>;
  saveAsaasCustomerId(
    customerId: string,
    environment: AsaasEnv,
    asaasCustomerId: string,
  ): Promise<void>;
  /**
   * Chamado quando um ID salvo localmente é rejeitado pelo Asaas
   * (ex.: ID de Sandbox reutilizado em Produção). Permite que o resolver
   * limpe o ID inválido e crie um novo transparentemente.
   */
  clearAsaasCustomerId?(
    customerId: string,
    environment: AsaasEnv,
  ): Promise<void>;
}

export type DocumentValidator = (digits: string) => boolean;

/** Default: apenas checa comprimento. Callers de produção devem passar isValidCPF/isValidCNPJ. */
const defaultValidator: DocumentValidator = (d) => d.length === 11 || d.length === 14;

function toDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D+/g, "");
}

function getStoredId(customer: CustomerRow, env: AsaasEnv): string | null {
  return env === "production"
    ? customer.asaas_customer_id_production
    : customer.asaas_customer_id_sandbox;
}

/** Erros do Asaas que indicam que o ID armazenado não existe naquele ambiente. */
function isInvalidCustomerError(err: unknown): boolean {
  const anyErr = err as { status?: number; message?: string; body?: unknown };
  const msg = (anyErr?.message ?? "").toLowerCase();
  if (anyErr?.status === 404) return true;
  return (
    msg.includes("customer inválido") ||
    msg.includes("customer invalido") ||
    msg.includes("customer not found") ||
    msg.includes("cliente não encontrado") ||
    msg.includes("cliente nao encontrado")
  );
}

// ─── IDEMPOTENCY: in-flight dedupe ───────────────────────────────────────────
// Evita criação duplicada quando múltiplas chamadas concorrentes (retries UI,
// duplo-click, etc.) resolvem o mesmo cliente. Escopo do módulo — vive durante
// a request/worker; não é cache persistente.
const inflight = new Map<string, Promise<string>>();

function inflightKey(env: AsaasEnv, customerId: string): string {
  return `${env}:${customerId}`;
}

/** Exposto para testes — nunca chame em produção. */
export function __resetResolverInflight(): void {
  inflight.clear();
}

export async function resolveAsaasCustomerId(deps: {
  customerId: string | null | undefined;
  environment: AsaasEnv;
  repo: CustomerRepo;
  gateway: AsaasCustomerGateway;
  validateDocument?: DocumentValidator;
}): Promise<string> {
  const { customerId, environment } = deps;

  if (!customerId) {
    throw new Error(
      "Selecione um cliente com CPF/CNPJ cadastrado antes de gerar a cobrança.",
    );
  }

  const key = inflightKey(environment, customerId);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      return await resolveInternal(deps);
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

async function resolveInternal(deps: {
  customerId: string | null | undefined;
  environment: AsaasEnv;
  repo: CustomerRepo;
  gateway: AsaasCustomerGateway;
  validateDocument?: DocumentValidator;
}): Promise<string> {
  const { customerId, environment, repo, gateway } = deps;
  const validate = deps.validateDocument ?? defaultValidator;

  const customer = await repo.findById(customerId!);
  if (!customer) throw new Error("Cliente não encontrado.");

  const documentDigits = toDigits(customer.document);
  if (!validate(documentDigits)) {
    throw new Error(
      `O cliente "${customer.name}" está sem CPF/CNPJ válido cadastrado. ` +
        `Abra o cadastro do cliente e informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido antes de gerar a cobrança.`,
    );
  }

  const storedId = getStoredId(customer, environment);

  console.log(
    JSON.stringify({
      scope: "customer-resolver",
      level: "info",
      msg: "resolve start",
      environment,
      customerId: customer.id,
      customerName: customer.name,
      cpfCnpj: documentDigits,
      hasStoredId: Boolean(storedId),
      storedId: storedId ?? null,
    }),
  );

  if (storedId) {
    if (gateway.updateCustomer) {
      try {
        const updated = await gateway.updateCustomer(storedId, {
          name: customer.name,
          email: customer.email ?? undefined,
          cpfCnpj: documentDigits,
          phone: toDigits(customer.phone) || undefined,
        });
        console.log(
          JSON.stringify({
            scope: "customer-resolver",
            level: "info",
            msg: "reuse ok (updated)",
            environment,
            customerId: customer.id,
            asaasCustomerId: updated.id,
          }),
        );
        return storedId;
      } catch (err) {
        if (isInvalidCustomerError(err)) {
          console.warn(
            JSON.stringify({
              scope: "customer-resolver",
              level: "warn",
              msg: "stored id invalid for env — recreating",
              environment,
              customerId: customer.id,
              storedId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
          if (repo.clearAsaasCustomerId) {
            await repo.clearAsaasCustomerId(customer.id, environment);
          }
        } else {
          console.warn(
            JSON.stringify({
              scope: "customer-resolver",
              level: "warn",
              msg: "update failed but id kept",
              environment,
              customerId: customer.id,
              storedId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
          return storedId;
        }
      }
    } else {
      return storedId;
    }
  }

  // IDEMPOTENCY REMOTA — antes de criar, tenta localizar por CPF/CNPJ.
  if (gateway.findByDocument) {
    try {
      const found = await gateway.findByDocument(documentDigits, customer.id);
      if (found?.id) {
        console.log(
          JSON.stringify({
            scope: "customer-resolver",
            level: "info",
            msg: "reused via findByDocument (idempotent)",
            environment,
            customerId: customer.id,
            asaasCustomerId: found.id,
          }),
        );
        await repo.saveAsaasCustomerId(customer.id, environment, found.id);
        return found.id;
      }
    } catch (err) {
      console.warn(
        JSON.stringify({
          scope: "customer-resolver",
          level: "warn",
          msg: "findByDocument failed — will attempt create",
          environment,
          customerId: customer.id,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  const created = await gateway.createCustomer({
    name: customer.name,
    email: customer.email ?? undefined,
    cpfCnpj: documentDigits,
    phone: toDigits(customer.phone) || undefined,
    externalReference: customer.id,
  });

  console.log(
    JSON.stringify({
      scope: "customer-resolver",
      level: "info",
      msg: "created in asaas",
      environment,
      customerId: customer.id,
      asaasCustomerId: created.id,
    }),
  );

  await repo.saveAsaasCustomerId(customer.id, environment, created.id);
  return created.id;
}
