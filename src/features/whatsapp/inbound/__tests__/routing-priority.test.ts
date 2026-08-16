
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleCheckoutTurn, peekCheckoutSession, saveCheckoutSession } from '../checkout-session.server';
import { BellaActionEngine } from '../../../bella-ai/actions';
import { handleWhatsAppInboundPayload } from '../router.server';

// Mocking dependencies
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: {
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
  },
}));

vi.mock('../../../bella-ai/actions', () => ({
  BellaActionEngine: {
    run: vi.fn(),
    interpret: vi.fn(),
  },
}));

vi.mock('../../../bella-ai/ai/gateway', () => ({
  bellaAIGateway: {
    ask: vi.fn(),
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

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    (supabaseAdmin.from('whatsapp_checkout_sessions').maybeSingle as any).mockResolvedValue({ data: { session_data: mockSession } });
    
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
    
    // 4. Ensure Financial Engine was NOT even considered in the router context
    // This part of the test would happen in router.server.ts
  });

  it('should NOT allow Financial Intent to steal "dinheiro" when checkout is active', async () => {
    // This is the core of the bug: if the router calls handleCheckoutTurn and it returns a result,
    // the router must return immediately and NOT proceed to BellaActionEngine.
    
    // We'll simulate the router's logic for this message
    const { handleWhatsAppInboundPayload } = await import('../router.server');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    
    // Setup Mocks for router
    (supabaseAdmin.from('companies').maybeSingle as any).mockImplementation((query: any) => {
      // Return company
      return Promise.resolve({ data: { id: companyId, name: 'Test Co' } });
    });
    
    // Mock the session lookup specifically
    (supabaseAdmin.from as any).mockImplementation((table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => {
              if (table === 'whatsapp_checkout_sessions') {
                return Promise.resolve({ data: { session_data: { step: 'WAITING_PAYMENT_METHOD', phone, companyId, updatedAt: Date.now() } } });
              }
              if (table === 'companies') {
                return Promise.resolve({ data: { id: companyId } });
              }
              return Promise.resolve({ data: null });
            }
          }),
          maybeSingle: () => Promise.resolve({ data: null }),
          single: () => Promise.resolve({ data: { id: 'conv_123' } }),
          in: () => ({ limit: () => Promise.resolve({ data: [{ id: 'cont_123', wa_id: phone }] }) })
        })
      }),
      insert: () => Promise.resolve({ error: null }),
      update: () => Promise.resolve({ error: null }),
      upsert: () => Promise.resolve({ data: { id: 'id' } })
    }));

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
