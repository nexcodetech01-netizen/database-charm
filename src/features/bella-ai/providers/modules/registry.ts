import type {
  BellaAlert,
  BellaInsight,
  BellaMetric,
  BellaModuleKey,
  BellaModuleProvider,
  BellaProviderContext,
  BellaSuggestion,
  BellaSummary,
} from "./base";
import { salesProvider } from "./sales.provider";
import { financeProvider } from "./finance.provider";
import { financeRealProvider } from "./finance-real.provider";
import { inventoryProvider } from "./inventory.provider";
import { customerProvider } from "./customer.provider";
import { marketingProvider } from "./marketing.provider";
import { accountingProvider } from "./accounting.provider";
import { taxProvider } from "./tax.provider";
import { executiveProvider } from "../../executive/providers/executive.provider";

/**
 * BellaProviderRegistry
 *
 * Ponto único de acesso da Bella IA aos módulos do ERP. A tela da Bella
 * consome EXCLUSIVAMENTE este registry — nunca acessa serviços/hooks de
 * módulos diretamente. Isso permite trocar mocks por consultas reais sem
 * alterar a UI da Bella.
 */
class BellaProviderRegistryImpl {
  private providers = new Map<BellaModuleKey, BellaModuleProvider>();

  register(provider: BellaModuleProvider): void {
    this.providers.set(provider.module, provider);
  }

  unregister(module: BellaModuleKey): void {
    this.providers.delete(module);
  }

  get(module: BellaModuleKey): BellaModuleProvider | undefined {
    return this.providers.get(module);
  }

  list(): BellaModuleProvider[] {
    return Array.from(this.providers.values());
  }

  // ---- Agregações cross-module (consumidas pela Bella) --------------------

  async getAllInsights(ctx: BellaProviderContext): Promise<BellaInsight[]> {
    const results = await Promise.all(this.list().map((p) => p.getInsights(ctx)));
    return results.flat();
  }

  async getAllSummaries(ctx: BellaProviderContext): Promise<BellaSummary[]> {
    return Promise.all(this.list().map((p) => p.getSummary(ctx)));
  }

  async getAllAlerts(ctx: BellaProviderContext): Promise<BellaAlert[]> {
    const results = await Promise.all(this.list().map((p) => p.getAlerts(ctx)));
    return results.flat();
  }

  async getAllMetrics(
    ctx: BellaProviderContext,
  ): Promise<Record<BellaModuleKey, BellaMetric[]>> {
    const entries = await Promise.all(
      this.list().map(async (p) => [p.module, await p.getMetrics(ctx)] as const),
    );
    return Object.fromEntries(entries) as Record<BellaModuleKey, BellaMetric[]>;
  }

  async getAllSuggestions(ctx: BellaProviderContext): Promise<BellaSuggestion[]> {
    const results = await Promise.all(this.list().map((p) => p.getSuggestions(ctx)));
    return results.flat();
  }
}

export const BellaProviderRegistry = new BellaProviderRegistryImpl();

// Registro padrão dos providers dos módulos.
BellaProviderRegistry.register(salesProvider);
// Financeiro: provider real com fallback interno para o mock quando não há
// dados no tenant (a Bella nunca precisa saber a origem).
BellaProviderRegistry.register(financeRealProvider);
// Referência mantida para preservar mocks existentes.
void financeProvider;
BellaProviderRegistry.register(inventoryProvider);
BellaProviderRegistry.register(customerProvider);
BellaProviderRegistry.register(marketingProvider);
// Sprint P0.2 — Bella Contadora: motor contábil (DRE, Balanço, EBITDA, KPIs).
BellaProviderRegistry.register(accountingProvider);
// Sprint P0.3 — Motor Tributário: DAS, RBT12, alíquota efetiva e projeções.
BellaProviderRegistry.register(taxProvider);
// Sprint P0.4 — Bella Executive Intelligence: panorama executivo consolidado.
BellaProviderRegistry.register(executiveProvider);
