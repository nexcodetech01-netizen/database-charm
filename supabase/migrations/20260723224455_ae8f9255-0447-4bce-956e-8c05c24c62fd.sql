
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS assigned_operator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS protocol text;

UPDATE public.whatsapp_conversations
   SET protocol = 'WA-' || upper(substring(replace(id::text,'-','') from 1 for 8))
 WHERE protocol IS NULL;

CREATE OR REPLACE FUNCTION public.whatsapp_touch_assignment()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.assigned_operator_id IS DISTINCT FROM OLD.assigned_operator_id THEN
    NEW.assigned_at := CASE WHEN NEW.assigned_operator_id IS NULL THEN NULL ELSE now() END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS whatsapp_conversations_touch_assignment ON public.whatsapp_conversations;
CREATE TRIGGER whatsapp_conversations_touch_assignment
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.whatsapp_touch_assignment();

ALTER TABLE public.whatsapp_conversations REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
