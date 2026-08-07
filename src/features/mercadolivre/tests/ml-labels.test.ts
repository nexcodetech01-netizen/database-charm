import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrderLabel } from '@/lib/mercadolivre.server';
import { labelaryService } from '@/features/printing/services/labelary.service';

// Mocking integrationFetch to simulate ML API
vi.mock('@/lib/http-client.server', () => ({
  integrationFetch: vi.fn(),
}));

import { integrationFetch } from '@/lib/http-client.server';

describe('Mercado Livre Labels Integration', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch PDF label successfully', async () => {
    // 1. Mock readSummaryRow
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: {
        access_token_encrypted: 'mock-token',
      },
    });

    // 2. Mock order fetch (shipment ID)
    (integrationFetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shipping: { id: 'ship-123' } }),
    });

    // 3. Mock label fetch (PDF)
    const mockPdfBuffer = Buffer.from('mock-pdf-content');
    (integrationFetch as any).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockPdfBuffer),
    });

    const result = await getOrderLabel(mockSupabase, 'comp-1', 'order-1');

    expect(result.type).toBe('pdf');
    expect(result.content).toBe(mockPdfBuffer.toString('base64'));
  });

  it('should fallback to ZPL if PDF fails', async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { access_token_encrypted: 'mock-token' },
    });

    (integrationFetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shipping: { id: 'ship-123' } }),
    });

    // Mock PDF fail
    (integrationFetch as any).mockResolvedValueOnce({
      ok: false,
    });

    // Mock ZPL success
    const mockZpl = '^XA^FDTest^FS^XZ';
    (integrationFetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockZpl),
    });

    const result = await getOrderLabel(mockSupabase, 'comp-1', 'order-1');

    expect(result.type).toBe('zpl');
    expect(result.content).toBe(mockZpl);
  });

  it('should throw clear error if shipment is missing', async () => {
    mockSupabase.maybeSingle.mockResolvedValueOnce({
      data: { access_token_encrypted: 'mock-token' },
    });

    (integrationFetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ shipping: {} }), // No ID
    });

    await expect(getOrderLabel(mockSupabase, 'comp-1', 'order-1'))
      .rejects.toThrow('O pedido não possui remessa associada.');
  });
});
