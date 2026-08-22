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
  },
}));

// Mock catalogService
vi.mock('@/features/catalog/services/catalog.service', () => ({
  catalogService: {
    addProducts: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('productsService Catalog Integration', () => {
  const mockCompanyId = '78bfccca-f3a5-4110-9983-13e073f3ba77';
  const mockProductId = 'prod-123';
  const MAIN_COLLECTION_ID = 'd71d809c-83c6-499e-b2bc-ebfcb1df28af';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should automatically link product to catalog when sales_channels contains "catalog"', async () => {
    // Setup Supabase mocks
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: mockProductId, status: 'active', sales_channels: ['loja_fisica', 'catalog'] },
            error: null,
          }),
        };
      }
      if (table === 'inventory_movements') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { from: vi.fn().mockReturnThis() };
    });

    // Execute service call
    await productsService.create({
      company_id: mockCompanyId,
      name: 'Test Product',
      price: 100,
      sales_channels: ['loja_fisica', 'catalog'],
      status: 'active',
      unit: 'UN',
    } as any);

    // Verify catalogService.addProducts was called
    // Note: It's called inside a dynamic import and a void promise, 
    // so we might need to wait or mock the import if it was a real environment.
    // In this Vitest setup, we mocked catalogService directly.
    
    // Since it's a dynamic import inside a void promise, we wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(catalogService.addProducts).toHaveBeenCalledWith(MAIN_COLLECTION_ID, [mockProductId]);
  });

  it('should NOT link to catalog when sales_channels does NOT contain "catalog"', async () => {
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'products') {
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: mockProductId, status: 'active', sales_channels: ['loja_fisica'] },
            error: null,
          }),
        };
      }
      return { from: vi.fn().mockReturnThis() };
    });

    await productsService.create({
      company_id: mockCompanyId,
      name: 'Test Product No Catalog',
      price: 100,
      sales_channels: ['loja_fisica'],
      status: 'active',
      unit: 'UN',
    } as any);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(catalogService.addProducts).not.toHaveBeenCalled();
  });
});
