import { createFileRoute } from "@tanstack/react-router";

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
            return new Response(
              JSON.stringify({ error: 'SUPERFRETE_TOKEN not configured' }),
              { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
          }

          const baseUrl = SUPERFRETE_ENV === 'production' 
            ? 'https://api.superfrete.com' 
            : 'https://sandbox.superfrete.com';

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
              state: sender?.state || "",
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
              state: recipient?.state || "",
              email: recipient?.email || null,
              phone: (recipient?.phone || "").replace(/\D/g, ''),
            },
            package: {
              format: parseInt(package_details?.format || "3"),
              weight: package_details?.peso_kg || 0.1,
              width: package_details?.largura_cm || 0,
              height: package_details?.altura_cm || 0,
              length: package_details?.comprimento_cm || 0,
            },
            options: {
              insurance_value: package_details?.valor_declarado || 0,
              receipt: false,
              own_hand: false,
              reverse: false,
              non_commercial: false,
              invoice_number: recipient?.invoice_number || null,
              services: service_code
            }
          };

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

          const cartData = await cartResponse.json();

          if (!cartResponse.ok) {
            return new Response(
              JSON.stringify({ 
                error: cartData.message || 'Falha ao adicionar ao carrinho',
                details: cartData 
              }),
              { status: cartResponse.status, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // 2. Checkout (Pay for everything in cart)
          const checkoutResponse = await fetch(`${baseUrl}/api/v0/checkout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPERFRETE_TOKEN}`,
              'User-Agent': 'NexOS Fashion (admin@nexxcode.com.br)',
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            }
          });

          const checkoutData = await checkoutResponse.json();

          if (!checkoutResponse.ok) {
             return new Response(
              JSON.stringify({ 
                error: checkoutData.message || 'Falha no checkout (saldo insuficiente?)',
                details: checkoutData 
              }),
              { status: checkoutResponse.status, headers: { 'Content-Type': 'application/json' } }
            );
          }

          // 3. Generate Label
          // Usually checkout returns order identifiers. 
          // SuperFrete documentation notes checkout generates the label if everything is fine.
          
          return Response.json({
            success: true,
            order_id: checkoutData.order_id || cartData.id,
            tracking_code: checkoutData.tracking_code || (checkoutData.packages && checkoutData.packages[0]?.tracking),
            label_url: checkoutData.label_url || (checkoutData.packages && checkoutData.packages[0]?.label),
            raw: checkoutData
          });

        } catch (error: any) {
          console.error('Label Route Error:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }
  }
});