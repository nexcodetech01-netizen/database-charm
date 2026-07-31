-- Estado transitório de cancelamento: o documento continua ocupando a venda
DROP INDEX IF EXISTS public.fiscal_documents_one_active_per_sale;
CREATE UNIQUE INDEX fiscal_documents_one_active_per_sale
  ON public.fiscal_documents (sale_id)
  WHERE sale_id IS NOT NULL
    AND status = ANY (ARRAY['draft','validating','signing','sending','authorized','cancelling']);

-- Novos eventos de auditoria do fluxo de cancelamento
ALTER TABLE public.fiscal_events DROP CONSTRAINT IF EXISTS fiscal_events_event_type_check;
ALTER TABLE public.fiscal_events ADD CONSTRAINT fiscal_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'created','validated','signed','sent','authorized','rejected',
    'cancelled','error','reissued','cancel_requested','cancelling','artifact_failed'
  ]));