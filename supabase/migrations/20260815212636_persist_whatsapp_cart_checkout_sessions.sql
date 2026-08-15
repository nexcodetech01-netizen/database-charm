-- FIX — carrinho e fechamento do WhatsApp guardados só em memória.
--
-- Achado real (2026-08-15, reportado pelo usuário testando um pedido de
-- verdade pelo catálogo): depois do bot resumir o pedido e perguntar a
-- forma de pagamento, a resposta do cliente ("Dinheiro") não foi
-- reconhecida como continuação do fechamento — caiu em outro sistema
-- (aparentemente Bella IA geral) que respondeu algo sobre saldo em caixa,
-- completamente fora de contexto.
--
-- Causa: tanto o carrinho quanto o fechamento conversacional (nome,
-- endereço, forma de pagamento) eram guardados só na memória do processo
-- do servidor (um `Map` em JavaScript) — o próprio código já avisava
-- isso nos comentários ("se o processo reiniciar, a sessão deixa de
-- existir"). Em ambientes modernos de hospedagem (serverless/edge, como
-- Cloudflare Workers), cada requisição pode ser atendida por uma
-- instância diferente, sem memória compartilhada da anterior — então a
-- sessão podia "sumir" a qualquer momento entre duas mensagens do mesmo
-- cliente, de forma imprevisível.
--
-- Correção: as duas sessões passam a ser gravadas nestas tabelas,
-- sobrevivendo entre mensagens de forma confiável, independente de qual
-- instância do servidor atende cada requisição. Nada muda no
-- comportamento da conversa em si — só onde o estado fica guardado.

CREATE TABLE IF NOT EXISTS public.whatsapp_cart_sessions (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone text NOT NULL,
  session_data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, phone)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_checkout_sessions (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone text NOT NULL,
  session_data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, phone)
);

-- Processamento de mensagens do WhatsApp roda no servidor com a service
-- role — não expomos essas tabelas a usuários autenticados/anônimos.
ALTER TABLE public.whatsapp_cart_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_checkout_sessions ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.whatsapp_cart_sessions TO service_role;
GRANT ALL ON public.whatsapp_checkout_sessions TO service_role;

CREATE INDEX IF NOT EXISTS idx_whatsapp_cart_sessions_updated_at
  ON public.whatsapp_cart_sessions (updated_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_checkout_sessions_updated_at
  ON public.whatsapp_checkout_sessions (updated_at);
