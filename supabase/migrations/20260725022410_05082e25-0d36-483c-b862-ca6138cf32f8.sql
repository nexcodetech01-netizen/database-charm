UPDATE public.company_pricing_policies
SET envelope = jsonb_set(
      jsonb_set(envelope, '{payload,defaults,idealMarginPct}', '50'::jsonb, true),
      '{serializedAt}', to_jsonb(now()::text), true
    ),
    version = version + 1,
    updated_at = now()
WHERE company_id = '78bfccca-f3a5-4110-9983-13e073f3ba77';