import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/shipping/calculate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { 
            cep_origem, 
            cep_destino, 
            peso_kg, 
            altura_cm, 
            largura_cm, 
            comprimento_cm, 
            format,
            valor_declarado 
          } = await request.json();

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

          const payload = {
            from: {
              postal_code: cep_origem.replace(/\D/g, ''),
            },
            to: {
              postal_code: cep_destino.replace(/\D/g, ''),
            },
            services: "1,2,17",
            package: {
              weight: peso_kg,
              width: largura_cm,
              height: altura_cm,
              length: comprimento_cm,
            },
            options: {
              insurance_value: valor_declarado,
              receipt: false,
              own_hand: false,
            }
          };

          const response = await fetch(`${baseUrl}/api/v0/calculator`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPERFRETE_TOKEN}`,
              'User-Agent': 'NexOS Fashion (admin@nexxcode.com.br)',
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          const data = await response.json();

          if (!response.ok) {
            console.error('SuperFrete API Error:', data);
            return new Response(
              JSON.stringify({ 
                error: data.message || 'Falha ao calcular frete na SuperFrete',
                details: data 
              }),
              { status: response.status, headers: { 'Content-Type': 'application/json' } }
            );
          }

          const normalized = (Array.isArray(data) ? data : [data])
            .filter((option: any) => !option.error)
            .map((option: any) => ({
              id: String(option.id || option.service || ""),
              servico: option.name || option.service_name,
              transportadora: "Correios",
              preco: parseFloat(option.price || option.discount_price || 0),
              prazo_dias: parseInt(option.delivery_time || 0),
            }));

          return Response.json(normalized);

        } catch (error: any) {
          console.error('Server Route Error:', error);
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }
    }
  }
});
