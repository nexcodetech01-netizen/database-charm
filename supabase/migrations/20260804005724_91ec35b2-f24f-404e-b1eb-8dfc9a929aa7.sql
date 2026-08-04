-- Migração para suporte à Janela de 24 horas do WhatsApp
-- Adiciona o campo de controle de última mensagem do cliente para gerenciar janelas de atendimento

-- 1. Tabela whatsapp_contacts
ALTER TABLE public.whatsapp_contacts 
ADD COLUMN IF NOT EXISTS ultima_mensagem_cliente_at TIMESTAMP WITH TIME ZONE;

-- 2. Tabela whatsapp_conversations
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS ultima_mensagem_cliente_at TIMESTAMP WITH TIME ZONE;

-- Garantir privilégios
GRANT SELECT, UPDATE ON public.whatsapp_contacts TO authenticated;
GRANT SELECT, UPDATE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_contacts TO service_role;
GRANT ALL ON public.whatsapp_conversations TO service_role;

-- Comentários para documentação
COMMENT ON COLUMN public.whatsapp_contacts.ultima_mensagem_cliente_at IS 'Data/hora da última mensagem enviada pelo cliente. Usado para controle da janela de 24h.';
COMMENT ON COLUMN public.whatsapp_conversations.ultima_mensagem_cliente_at IS 'Data/hora da última mensagem do cliente nesta conversa.';
