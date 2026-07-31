-- Garante unicidade do Phone Number ID por empresa (permite NULL para empresas ainda não configuradas)
CREATE UNIQUE INDEX IF NOT EXISTS companies_whatsapp_phone_number_id_key
  ON public.companies (whatsapp_phone_number_id)
  WHERE whatsapp_phone_number_id IS NOT NULL;