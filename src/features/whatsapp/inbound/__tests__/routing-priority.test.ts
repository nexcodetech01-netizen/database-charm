
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleCheckoutTurn } from '../checkout-session.server';
import { BellaActionEngine } from '../../../bella-ai/actions';
import { handleWhatsAppInboundPayload } from '../router.server';

// Mocking dependencies
const mockSupabase = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(),
  single: vi.fn(),
  upsert: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  neq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  or: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
};

vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: mockSupabase,
}));

vi.mock('../../../bella-ai/actions', () => ({
  BellaActionEngine: {
    run: vi.fn(),
    interpret: vi.fn(),
  },
}));

vi.mock('../../../bella-ai/ai/gateway', () => ({
  bellaAIGateway: {
    chat: vi.fn(),
  },
}));

vi.mock('../../../bella-ai/context', () => ({
  bellaConversationManager: {
    clear: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('@/lib/whatsapp.server', () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue({ ok: true, waMessageId: 'msg_123' }),
  sendWhatsAppImage: vi.fn().mockResolvedValue({ ok: true, waMessageId: 'img_123' }),
}));

describe('Contextual Routing Priority (Checkout vs Financial)', () => {
  const companyId = 'comp_123';
  const phone = '5511999999999';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prioritize checkout session for "dinheiro" when a checkout is active', async () => {
    // 1. Setup an active checkout session waiting for payment method
    const mockSession = {
      companyId,
      phone,
      step: 'WAITING_PAYMENT_METHOD',
      buyerName: 'Test User',
      customer: { fullName: 'Test User' },
      fulfillment: 'delivery',
      deliveryFee: 10,
      totalWithFreight: 110,
      updatedAt: Date.now(),
    };

    mockSupabase.maybeSingle.mockResolvedValue({ data: { session_data: mockSession } });
    
    // 2. Simulate message "dinheiro"
    const result = await handleCheckoutTurn({
      companyId,
      phone,
      text: 'dinheiro',
    });

    // 3. Verify it was intercepted by checkout and moved to next step (document/CPF)
    expect(result).not.toBeNull();
    expect(result?.step).toBe('WAITING_DOCUMENT');
    expect(result?.text).toContain('CPF');
  });

  it('should NOT allow Financial Intent to steal "dinheiro" when checkout is active', async () => {
    // Mock the session lookup
    mockSupabase.maybeSingle.mockImplementation(() => {
        // Return company first, then session
        const calls = mockSupabase.from.mock.calls;
        const lastTable = calls[calls.length - 1][0];
        if (lastTable === 'companies') {
          return Promise.resolve({ data: { id: companyId, name: 'Test Co' } });
        }
        if (lastTable === 'whatsapp_checkout_sessions') {
          return Promise.resolve({ data: { session_data: { step: 'WAITING_PAYMENT_METHOD', phone, companyId, updatedAt: Date.now() } } });
        }
        return Promise.resolve({ data: null });
    });

    mockSupabase.single.mockImplementation(() => {
        const calls = mockSupabase.from.mock.calls;
        const lastTable = calls[calls.length - 1][0];
        if (lastTable === 'whatsapp_conversations') {
            return Promise.resolve({ data: { id: 'conv_123', status: 'open' } });
        }
        if (lastTable === 'whatsapp_contacts') {
            return Promise.resolve({ data: { id: 'cont_123' } });
        }
        return Promise.resolve({ data: null });
    });

    mockSupabase.in.mockReturnThis();
    mockSupabase.limit.mockReturnThis();
    mockSupabase.select.mockReturnThis();

    // Trigger the inbound handler
    await handleWhatsAppInboundPayload({
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'pn_123' },
            contacts: [{ wa_id: phone, profile: { name: 'Test' } }],
            messages: [{ id: 'wa_msg_1', from: phone, type: 'text', text: { body: 'dinheiro' }, timestamp: Date.now()/1000 }]
          }
        }]
      }]
    });

    // VERIFICATION: BellaActionEngine.run should NOT have been called
    expect(BellaActionEngine.run).not.toHaveBeenCalled();
  });
});
