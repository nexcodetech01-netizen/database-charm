ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT IF EXISTS whatsapp_conversations_assigned_operator_id_fkey;

ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_assigned_operator_id_fkey
  FOREIGN KEY (assigned_operator_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_assigned_operator_id
  ON public.whatsapp_conversations(assigned_operator_id);