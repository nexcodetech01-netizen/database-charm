import type { SupabaseClient } from "@supabase/supabase-js";
import { DocumentsRepository } from "../repositories/documents.repository";
import { SalesRepository } from "../repositories/sales.repository";
import { CustomersRepository } from "../repositories/customers.repository";
import { ProductsRepository } from "../repositories/products.repository";
import { CompanyRepository } from "../repositories/company.repository";
import { TaxRepository } from "../repositories/tax.repository";
import { CertificateRepository } from "../repositories/certificate.repository";
import { StatusRepository } from "../repositories/status.repository";
import {
  CRT_NOT_CONFIGURED_MESSAGE,
  isCrtCoherent,
  crtCoherenceMessage,
  requireCrt
} from "../lib/crt";
import { resolveItemTaxes } from "../lib/item-taxes";
import { blocksNewFiscalDocument } from "../lib/fiscal-status";
import { toDocLikes } from "../lib/issue-guard";
import type { 
  NfeEnvironment, 
  TaxRegime as FiscalTaxRegime, 
  FiscalSimulationResult as FiscalValidationResult, 
  SimulationIssue as FiscalIssue 
} from "../types";


export class EmissionService {
  private readonly docsRepo: DocumentsRepository;
  private readonly salesRepo: SalesRepository;
  private readonly customersRepo: CustomersRepository;
  private readonly productsRepo: ProductsRepository;
  private readonly companyRepo: CompanyRepository;
  private readonly taxRepo: TaxRepository;
  private readonly certRepo: CertificateRepository;
  private readonly statusRepo: StatusRepository;

  constructor(
    private readonly supabase: SupabaseClient,
    private readonly companyId: string
  ) {
    this.docsRepo = new DocumentsRepository(this.supabase);
    this.salesRepo = new SalesRepository(this.supabase);
    this.customersRepo = new CustomersRepository(this.supabase);
    this.productsRepo = new ProductsRepository(this.supabase);
    this.companyRepo = new CompanyRepository(this.supabase);
    this.taxRepo = new TaxRepository(this.supabase);
    this.certRepo = new CertificateRepository(this.supabase);
    this.statusRepo = new StatusRepository(this.supabase);
  }

  async validate(saleId: string, environment?: NfeEnvironment): Promise<FiscalValidationResult> {
    const blockers: FiscalIssue[] = [];
    const warnings: FiscalIssue[] = [];
    const push = (issue: FiscalIssue) => (issue.severity === "error" ? blockers : warnings).push(issue);

    const sale = await this.salesRepo.findHeader(this.companyId, saleId);
    if (!sale) throw new Error("Venda não encontrada.");

    // 1) Cliente
    let customer = null;
    if (sale.customer_id) {
      customer = await this.customersRepo.findFiscalInfo(this.companyId, sale.customer_id);
    }
    const customerAddress = customer
      ? [
          [customer.address, customer.address_number].filter(Boolean).join(", "),
          customer.neighborhood,
          [customer.city, customer.state].filter(Boolean).join("/"),
          customer.zip,
        ]
          .filter((p) => p && String(p).trim().length > 0)
          .join(" · ") || null
      : null;

    if (!customer) {
      push({
        id: "customer.missing",
        field: "customer",
        severity: "error",
        step: "cliente",
        title: "Cliente não informado na venda",
        detail: "NF-e exige um destinatário identificado.",
        hint: "Vincule um cliente à venda antes de emitir.",
      });
    } else {
      if (!customer.name)
        push({
          id: "customer.name",
          field: "customer.name",
          severity: "error",
          step: "cliente",
          title: "Cliente sem nome",
          detail: "Preencha o nome/razão social do cliente.",
        });
      if (!customer.document)
        push({
          id: "customer.document",
          field: "customer.document",
          severity: "error",
          step: "cliente",
          title: "Cliente sem CPF/CNPJ",
          detail: "Documento é obrigatório para emissão.",
        });
      if (!customer.address || !customer.city || !customer.state || !customer.zip) {
        push({
          id: "customer.address",
          field: "customer.address",
          severity: "error",
          step: "cliente",
          title: "Endereço do cliente incompleto",
          detail: "Logradouro, cidade, UF e CEP são obrigatórios.",
          hint: "Complete o cadastro do cliente.",
        });
      } else if (customer.state.length !== 2) {
        push({
          id: "customer.state",
          field: "customer.address.state",
          severity: "error",
          step: "cliente",
          title: "UF inválida",
          detail: "Use a sigla com 2 letras (ex: SP).",
        });
      }
    }

    // 2) Itens
    const itemList = await this.salesRepo.listItems(sale.id);
    if (itemList.length === 0) {
      push({
        id: "items.empty",
        field: "items",
        severity: "error",
        step: "venda",
        title: "Venda sem itens",
        detail: "NF-e precisa de ao menos um item.",
      });
    } else {
      itemList.forEach((it, i) => {
        if (!it.description)
          push({
            id: `items.${i}.desc`,
            field: `items[${i}].description`,
            severity: "error",
            step: "venda",
            title: `Item ${i + 1} sem descrição`,
            detail: "Descrição do produto é obrigatória.",
          });
        if (!(Number(it.quantity ?? 0) > 0))
          push({
            id: `items.${i}.qty`,
            field: `items[${i}].quantity`,
            severity: "error",
            step: "venda",
            title: `Item ${i + 1} com quantidade inválida`,
            detail: "Quantidade deve ser maior que zero.",
          });
        if (!(Number(it.unit_price ?? 0) >= 0))
          push({
            id: `items.${i}.price`,
            field: `items[${i}].unitPrice`,
            severity: "error",
            step: "venda",
            title: `Item ${i + 1} com preço inválido`,
            detail: "Preço não pode ser negativo.",
          });
      });
    }

    // 3) NCM
    let itemsNcmSummary: string | null = null;
    const byId = new Map<string, { id: string; name: string | null; ncm: string | null }>();
    const productIds = Array.from(
      new Set(itemList.map((it) => it.product_id).filter((v): v is string => Boolean(v))),
    );
    if (productIds.length) {
      const list = await this.productsRepo.findNcmInfo(this.companyId, productIds);
      for (const p of list) byId.set(p.id, p);

      const missing = itemList
        .map((it) => (it.product_id ? byId.get(it.product_id) : null))
        .filter((p): p is { id: string; name: string | null; ncm: string | null } => Boolean(p))
        .filter((p) => !p.ncm)
        .map((p) => p.name ?? "Produto");
      const withoutProduct = itemList.filter((it) => !it.product_id).length;
      const uniqueMissing = Array.from(new Set(missing));
      if (uniqueMissing.length || withoutProduct > 0) {
        push({
          id: "items.ncm",
          field: "items.ncm",
          severity: "error",
          step: "venda",
          title: "Produtos sem NCM",
          detail: uniqueMissing.length
            ? `Produtos sem NCM:\n${uniqueMissing.map((n) => `- ${n}`).join("\n")}`
            : "Há itens sem produto vinculado — não é possível obter o NCM.",
          hint: "Cadastre o NCM no cadastro de cada produto.",
        });
      }
      const codes = Array.from(new Set(list.map((p) => p.ncm).filter(Boolean))) as string[];
      itemsNcmSummary = codes.length === 1 ? codes[0] : codes.length > 1 ? "Vários" : null;
    }

    const total = Number(sale.grand_total ?? 0);
    if (!(total > 0)) {
      push({
        id: "totals.total",
        field: "totals.total",
        severity: "error",
        step: "venda",
        title: "Valor total da venda deve ser maior que zero",
        detail: "Confira valores e descontos antes de emitir.",
      });
    }

    const co = (await this.companyRepo.getProfile(this.companyId)) || ({} as any);
    if (!co.cnpj || !co.ie || !co.address || !co.city || !co.state || !co.zipcode) {
      push({
        id: "company.profile",
        field: "company",
        severity: "error",
        step: "empresa",
        title: "Dados fiscais da empresa incompletos",
        detail: "CNPJ, IE e endereço fiscal são obrigatórios.",
        hint: "Complete em Fiscal → Configuração → Empresa.",
      });
    }

    // 4) Settings
    const s = await this.taxRepo.getSettings(this.companyId);
    if (!s) {
      push({
        id: "settings.missing",
        field: "settings",
        severity: "error",
        step: "regras",
        title: "Regras fiscais não configuradas",
        detail: "CFOP, natureza da operação e série não estão definidos.",
        hint: "Abra Fiscal → Configuração → Regras.",
      });
    } else {
      if (!s.defaultCfop)
        push({
          id: "settings.cfop",
          field: "settings.cfop",
          severity: "error",
          step: "regras",
          title: "CFOP padrão ausente",
          detail: "Defina um CFOP padrão (ex: 5102).",
        });
      if (!s.operationNature)
        push({
          id: "settings.nature",
          field: "settings.nature",
          severity: "error",
          step: "regras",
          title: "Natureza da operação ausente",
          detail: "Ex: 'Venda de mercadoria adquirida ou recebida de terceiros'.",
        });
      if (!s.nfeSeries || s.nfeSeries < 1)
        push({
          id: "settings.series",
          field: "settings.series",
          severity: "error",
          step: "regras",
          title: "Série da NF-e não configurada",
          detail: "Defina a série (normalmente 1).",
        });
      if ((s.taxRegime === "simples" || s.taxRegime === "mei") && !s.defaultCsosn)
        push({
          id: "settings.csosn",
          field: "settings.csosn",
          severity: "error",
          step: "regras",
          title: "CSOSN padrão obrigatório",
          detail:
            s.taxRegime === "mei"
              ? "MEI exige CSOSN padrão (ex: 102, 103, 300, 400, 500 ou 900)."
              : "Simples Nacional exige CSOSN padrão (ex: 102).",
        });
      if (!s.crt)
        push({
          id: "settings.crt",
          field: "settings.crt",
          severity: "error",
          step: "regras",
          title: "CRT não informado",
          detail: `${CRT_NOT_CONFIGURED_MESSAGE} A emissão fica bloqueada até que o Código de Regime Tributário seja definido.`,
        });
      else if (
        s.taxRegime &&
        !isCrtCoherent(s.taxRegime as FiscalTaxRegime, s.crt)
      )
        push({
          id: "settings.crt.coherence",
          field: "settings.crt",
          severity: "error",
          step: "regras",
          title: "CRT incompatível com o regime tributário",
          detail: crtCoherenceMessage(s.taxRegime as FiscalTaxRegime),
          hint: "Revise em Fiscal → Configuração → Regras.",
        });

      // 4.1) Tributos por item
      itemList.forEach((it, i) => {
        const taxes = resolveItemTaxes(
          s.crt || undefined,
          { cst: s.defaultCsosn ?? null, amount: Number(it.total ?? 0) },
          s.defaultCsosn ?? null,
        );
        if (!taxes.icms.situacaoTributaria)
          push({
            id: `items.${i}.icms`,
            field: `items[${i}].icms`,
            severity: "error",
            step: "regras",
            title: `Item ${i + 1} sem grupo ICMS`,
            detail: "Defina o CST/CSOSN de ICMS nas regras fiscais.",
          });
        if (!taxes.pis.situacaoTributaria)
          push({
            id: `items.${i}.pis`,
            field: `items[${i}].pis`,
            severity: "error",
            step: "regras",
            title: `Item ${i + 1} sem grupo PIS`,
            detail: "O item seria transmitido sem o grupo PIS (rejeição 745).",
            hint: "Revise o CRT/regime tributário em Fiscal → Configuração → Regras.",
          });
        if (!taxes.cofins.situacaoTributaria)
          push({
            id: `items.${i}.cofins`,
            field: `items[${i}].cofins`,
            severity: "error",
            step: "regras",
            title: `Item ${i + 1} sem grupo COFINS`,
            detail: "O item seria transmitido sem o grupo COFINS (rejeição 750).",
            hint: "Revise o CRT/regime tributário em Fiscal → Configuração → Regras.",
          });
      });
    }

    // 5) Certificado
    const certs = await this.certRepo.list(this.companyId);
    const activeCert = certs.find((c) => c.isActive) ?? null;
    let daysLeft: number | null = null;
    if (!activeCert) {
      push({
        id: "cert.missing",
        field: "certificate",
        severity: "error",
        step: "certificado",
        title: "Nenhum certificado A1 ativo",
        detail: "Envie um certificado digital A1 válido.",
      });
    } else if (activeCert.validTo) {
      daysLeft = Math.round((new Date(activeCert.validTo).getTime() - Date.now()) / 86_400_000);
      if (daysLeft < 0)
        push({
          id: "cert.expired",
          field: "certificate",
          severity: "error",
          step: "certificado",
          title: "Certificado A1 vencido",
          detail: `Vencido há ${Math.abs(daysLeft)} dia(s).`,
        });
      else if (daysLeft < 30)
        push({
          id: "cert.expiring",
          field: "certificate",
          severity: "warning",
          step: "certificado",
          title: "Certificado vence em breve",
          detail: `Vence em ${daysLeft} dia(s). Renove o quanto antes.`,
        });
    }

    // 6) Senha do certificado
    if (activeCert) {
      const hasCertPwd = await this.statusRepo.hasSecret(this.companyId, "cert_password", undefined, activeCert.id);
      if (!hasCertPwd) {
        push({
          id: "cert.password",
          field: "certificate.password",
          severity: "error",
          step: "certificado",
          title: "Senha do certificado não cadastrada",
          detail: "Informe a senha do PFX para permitir assinatura do XML.",
        });
      }
    }

    // 7) Provedor
    const providerRow = await this.statusRepo.getProviderConfig(this.companyId);
    const providerId = (providerRow as any)?.provider_id ?? "mock";
    const apiUrl = (providerRow as any)?.api_url ?? null;
    const lastHealth = (providerRow as any)?.last_health_status ?? null;
    const hasApiKey = await this.statusRepo.hasSecret(this.companyId, "provider_api_key");

    if (providerId === "mock") {
      push({
        id: "provider.mock",
        field: "provider",
        severity: "warning",
        step: "provedor",
        title: "Provedor em modo Mock",
        detail: "A emissão será simulada e NÃO será autorizada pela SEFAZ.",
        hint: "Configure Focus/PlugNotas/TecnoSpeed para emitir de verdade.",
      });
    } else {
      if (!apiUrl)
        push({
          id: "provider.url",
          field: "provider.url",
          severity: "error",
          step: "provedor",
          title: "URL do provedor não configurada",
          detail: "Informe a URL da API do provedor.",
        });
      if (!hasApiKey)
        push({
          id: "provider.key",
          field: "provider.key",
          severity: "error",
          step: "provedor",
          title: "API Key do provedor ausente",
          detail: "Cadastre a API Key com segurança.",
        });
      if (lastHealth === "error")
        push({
          id: "provider.health",
          field: "provider.health",
          severity: "warning",
          step: "provedor",
          title: "Último health-check falhou",
          detail: "Teste o provedor no diagnóstico antes de emitir.",
        });
    }

    // 8) Duplicidade
    const existingDocs = await this.docsRepo.findBySaleId(this.companyId, sale.id);
    if (blocksNewFiscalDocument(toDocLikes(existingDocs))) {
      push({
        id: "duplicate",
        field: "sale",
        severity: "error",
        step: "venda",
        title: "Já existe NF-e ativa para esta venda",
        detail: "Cancele ou consulte a nota existente antes de reemitir.",
      });
    }

    const finalEnv: NfeEnvironment = environment ?? s?.defaultEnvironment ?? "homologation";

    return {
      ok: blockers.length === 0,
      saleId: sale.id,
      environment: finalEnv,
      provider: providerId,
      blockers,
      warnings,
      summary: {
        customerName: customer?.name ?? null,
        customerDocument: customer?.document ?? null,
        customerEmail: customer?.email ?? null,
        customerAddress,
        itemCount: itemList.length,
        totalAmount: total,
        cfop: s?.defaultCfop ?? null,
        ncm: itemsNcmSummary,
        csosn: s?.defaultCsosn ?? null,
        crt: s?.crt ?? null,
        natureza: s?.operationNature ?? null,
        series: s?.nfeSeries ?? null,
        numberPreview: s?.nfeNextNumber ?? null,
        hasCertificate: Boolean(activeCert),
        certificateAlias: activeCert?.alias ?? null,
        certificateValidTo: activeCert?.validTo ?? null,
        hasProviderKey: Boolean(hasApiKey),
        certificateExpiresIn: daysLeft,
        companyName: co.legalName ?? null,
        companyCnpj: co.cnpj ?? null,
        saleNumber: sale.number ?? null,
        items: itemList.map((it) => ({
          description: it.description ?? (it.product_id ? (byId.get(it.product_id)?.name ?? "Item") : "Item"),
          quantity: Number(it.quantity ?? 0),
          unitPrice: Number(it.unit_price ?? 0),
          total: Number(it.total ?? 0),
          ncm: it.product_id ? (byId.get(it.product_id)?.ncm ?? null) : null,
        })),
      },
    };
  }

  async createDraft(saleId: string, options: { 
    environment: NfeEnvironment;
    provider: string;
    series: number;
    cfop: string;
    natureza: string;
    crt: number;
    regime: string;
  }): Promise<string> {
    const draft = await this.docsRepo.insert(this.companyId, {
      sale_id: saleId,
      environment: options.environment,
      provider_id: options.provider,
      status: "draft",
      series: options.series,
      cfop: options.cfop,
      operation_nature: options.natureza,
      tax_regime: options.regime,
      crt: options.crt,
      created_at: new Date().toISOString(),
    });
    return draft.id;
  }
}
