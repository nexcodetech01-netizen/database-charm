import { createFileRoute } from "@tanstack/react-router";
// Versão Final v5 - Diagnóstico Completo

// Force rebuild 4

// Versão com tratamento de erro e logs detalhados v3

// Versão com tratamento de erro e logs detalhados



export const Route = createFileRoute("/api/public/shipping/labels")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { 
            quote_id,
            sender,
            recipient,
            package_details,
            service_code
          } = body;


          const SUPERFRETE_TOKEN = process.env['SUPERFRETE_TOKEN'];
          const SUPERFRETE_ENV = process.env['SUPERFRETE_ENV'] || 'sandbox';

          if (!SUPERFRETE_TOKEN) {
            console.error('[SHIPPING_LABELS] Erro: SUPERFRETE_TOKEN não configurado');
            return new Response(
              JSON.stringify({ error: 'SUPERFRETE_TOKEN not configured' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }

          const baseUrl = SUPERFRETE_ENV === 'production' 
            ? 'https://api.superfrete.com' 
            : 'https://sandbox.superfrete.com';

          console.log(`[SHIPPING_LABELS] Usando ambiente: ${SUPERFRETE_ENV} (${baseUrl})`);

          // 1. Add to cart
          const cartPayload = {
            from: {
              name: sender?.name || "NexOS Fashion",
              cpf_cnpj: (sender?.document || "").replace(/\D/g, ''),
              postal_code: (sender?.postal_code || "").replace(/\D/g, ''),
              address: sender?.address || "",
              number: sender?.number || "",
              complement: sender?.complement || "",
              district: sender?.district || "",
              city: sender?.city || "",
              state_abbr: sender?.state || "", // API expects state_abbr
              email: sender?.email || null,
              phone: (sender?.phone || "").replace(/\D/g, ''),
            },
            to: {
              name: recipient?.name || "",
              cpf_cnpj: (recipient?.document || "").replace(/\D/g, ''),
              postal_code: (recipient?.postal_code || "").replace(/\D/g, ''),
              address: recipient?.address || "",
              number: recipient?.number || "",
              complement: recipient?.complement || "",
              district: recipient?.district || "",
              city: recipient?.city || "",
              state_abbr: recipient?.state || "", // API expects state_abbr
              email: recipient?.email || null,
              phone: (recipient?.phone || "").replace(/\D/g, ''),
            },
            service: service_code, // Uses the exact ID/value from calculator
            volumes: [{ // API expects volumes array
              format: parseInt(package_details?.format || "3"),
              weight: package_details?.peso_kg || 0.1,
              width: package_details?.largura_cm || 0,
              height: package_details?.altura_cm || 0,
              length: package_details?.comprimento_cm || 0,
            }],
            options: {
              insurance_value: package_details?.valor_declarado || 0,
              receipt: false,
              own_hand: false,
              reverse: false,
              non_commercial: false,
              invoice_number: recipient?.invoice_number || null,
            }
          };

          const rawCartPayload = JSON.stringify(cartPayload);
          console.log('[SHIPPING_LABELS] RAW_PAYLOAD_START' + rawCartPayload + 'RAW_PAYLOAD_END');

          const cartResponse = await fetch(`${baseUrl}/api/v0/cart`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPERFRETE_TOKEN}`,
              'User-Agent': 'NexOS Fashion (admin@nexxcode.com.br)',
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(cartPayload),
          });

          const cartText = await cartResponse.text();
          console.log(`[SHIPPING_LABELS] Resposta BRUTA /api/v0/cart: ${cartText}`);
          const cartData = JSON.parse(cartText || '{}');

          if (!cartResponse.ok) {
            console.error('[SHIPPING_LABELS] Erro no Carrinho:', cartData.message || cartData.error || 'Erro desconhecido');
            return new Response(
              JSON.stringify({ 
                error: cartData.message || cartData.error || 'Falha ao adicionar ao carrinho',
                details: cartData 
              }),
              { status: cartResponse.status, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // 2. Checkout (Pay for everything in cart)
          console.log('[SHIPPING_LABELS] Iniciando /api/v0/checkout...');
          const checkoutPayload = {
            orders: [cartData.id]
          };
          console.log(`[SHIPPING_LABELS] Enviando para /api/v0/checkout: ${JSON.stringify(checkoutPayload)}`);

          const checkoutResponse = await fetch(`${baseUrl}/api/v0/checkout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPERFRETE_TOKEN}`,
              'User-Agent': 'NexOS Fashion (admin@nexxcode.com.br)',
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(checkoutPayload),
          });

          const checkoutData = await checkoutResponse.json().catch(() => ({}));
          console.log(`[SHIPPING_LABELS] Resposta /api/v0/checkout (Status ${checkoutResponse.status}):`, JSON.stringify(checkoutData, null, 2));

          if (!checkoutResponse.ok) {
             console.error('[SHIPPING_LABELS] Erro no Checkout:', checkoutData.message || checkoutData.error || 'Erro desconhecido');
             return new Response(
              JSON.stringify({ 
                error: checkoutData.message || checkoutData.error || 'Falha no checkout (saldo insuficiente?)',
                details: checkoutData 
              }),
              { status: checkoutResponse.status, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // 3. Generate Label
          // Usually checkout returns order identifiers. 
          // SuperFrete documentation notes checkout generates the label if everything is fine.
          
          const labelResult = {
            success: true,
            order_id: checkoutData.order_id || (checkoutData.orders && checkoutData.orders[0]?.id) || cartData.id,
            tracking_code: checkoutData.tracking_code || (checkoutData.packages && checkoutData.packages[0]?.tracking) || (checkoutData.orders && checkoutData.orders[0]?.packages?.[0]?.tracking),
            label_url: checkoutData.label_url || (checkoutData.packages && checkoutData.packages[0]?.label) || (checkoutData.orders && checkoutData.orders[0]?.packages?.[0]?.label),
            raw: checkoutData
          };

          console.log('[SHIPPING_LABELS] Resultado Final:', JSON.stringify(labelResult, null, 2));
          return Response.json(labelResult);

        } catch (error: any) {
          console.error('[SHIPPING_LABELS] Erro Crítico na Rota:', error);
          return new Response(
            JSON.stringify({ 
              error: error.message || 'Erro interno inesperado',
              stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }
  }
});