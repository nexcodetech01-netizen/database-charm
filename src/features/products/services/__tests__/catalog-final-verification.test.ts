import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productsService } from '../products.service';
import { supabase } from '@/integrations/supabase/client';
import { catalogService } from '@/features/catalog/services/catalog.service';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockReturnThis(),
  },
}));

// Mock catalogService
vi.mock('@/features/catalog/services/catalog.service', () => ({
  catalogService: {
    addProducts: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Catalog Integration Final Verification', () => {
  const mockCompanyId = '78bfccca-f3a5-4110-9983-13e073f3ba77';
  const mockProductId = 'prod-verified-123';
  const MAIN_COLLECTION_ID = 'd71d809c-83c6-499e-b2bc-ebfcb1df28af';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should ensure catalog is present in the create payload and triggers auto-linking', async () => {
    // 1. Setup mock for products.insert chain: .from().insert().select().single()
    const mockInsert = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: mockProductId, status: 'active', sales_channels: ['loja_fisica', 'catalog'] },
      error: null,
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          insert: mockInsert,
          select: mockSelect,
          single: mockSingle,
        };
      }
      if (table === 'inventory_movements') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { from: vi.fn().mockReturnThis() };
    });

    // 2. Simulate the EXACT payload that should come from ProductForm for a NEW product
    const payload = {
      company_id: mockCompanyId,
      name: 'Verified Catalog Product',
      sku: 'VERIFIED-001',
      barcode: 'SEM GTIN',
      ncm: '12345678',
      brand: 'Generica',
      status: 'active',
      unit: 'UN',
      price: 100,
      cost: 50,
      sales_channels: ['loja_fisica', 'catalog'], // This is what we fixed in ProductForm
      product_type: 'simple',
    };

    // 3. Execute create
    await productsService.create(payload as any);

    // 4. Verify the insert payload contained 'catalog'
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      sales_channels: expect.arrayContaining(['catalog'])
    }));

    // 5. Verify catalogService.addProducts was triggered
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(catalogService.addProducts).toHaveBeenCalledWith(MAIN_COLLECTION_ID, [mockProductId]);
  });
});
