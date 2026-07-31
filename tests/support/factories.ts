/**
 * Factories for generating deterministic-ish test data.
 * Kept intentionally small — the E2E suite mostly reads/writes real
 * Supabase data through the UI, so we only need unique names.
 */

const rand = () => Math.random().toString(36).slice(2, 8);

export const factories = {
  product: (overrides: Partial<{ name: string; sku: string; price: number }> = {}) => ({
    name: `Produto E2E ${rand()}`,
    sku: `SKU-${rand().toUpperCase()}`,
    price: 99.9,
    ...overrides,
  }),
  category: (overrides: Partial<{ name: string }> = {}) => ({
    name: `Categoria E2E ${rand()}`,
    ...overrides,
  }),
  supplier: (overrides: Partial<{ name: string }> = {}) => ({
    name: `Fornecedor E2E ${rand()}`,
    ...overrides,
  }),
  customer: (overrides: Partial<{ name: string; email: string }> = {}) => ({
    name: `Cliente E2E ${rand()}`,
    email: `cliente-${rand()}@example.com`,
    ...overrides,
  }),
  appointment: (overrides: Partial<{ title: string }> = {}) => ({
    title: `Compromisso E2E ${rand()}`,
    ...overrides,
  }),
  charge: (overrides: Partial<{ description: string; amount: number }> = {}) => ({
    description: `Cobrança E2E ${rand()}`,
    amount: 150.0,
    ...overrides,
  }),
};
