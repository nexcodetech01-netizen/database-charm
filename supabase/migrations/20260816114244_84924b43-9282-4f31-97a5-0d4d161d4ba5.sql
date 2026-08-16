-- Adicionar configurações de notificação ao perfil do usuário
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
  "catalog.order.received": {"sound": true, "browser": true},
  "sale.created": {"sound": false, "browser": true},
  "finance.invoice.overdue": {"sound": true, "browser": true},
  "inventory.min_stock_reached": {"sound": false, "browser": true}
}'::jsonb;

-- Comentário para documentação
COMMENT ON COLUMN public.profiles.notification_settings IS 'Preferências granulares de notificação por tipo de evento.';
