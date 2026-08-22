import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productsService } from '../products.service';
import { supabase } from '@/integrations/supabase/client';
import { catalogService } from '@/features/catalog/services/catalog.service';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
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
    // Mock the specific chain for products table
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: mockProductId, status: 'active', sales_channels: ['loja_fisica', 'catalog'] },
      error: null,
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });

    // Mock for inventory_movements table
    const mockMovInsert = vi.fn().mockResolvedValue({ error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'products') {
        return { insert: mockInsert };
      }
      if (table === 'inventory_movements') {
        return { insert: mockMovInsert };
      }
      return {};
    });

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
      sales_channels: ['loja_fisica', 'catalog'],
      product_type: 'simple',
    };

    await productsService.create(payload as any);

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      sales_channels: expect.arrayContaining(['catalog'])
    }));

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(catalogService.addProducts).toHaveBeenCalledWith(MAIN_COLLECTION_ID, [mockProductId]);
  });
});
