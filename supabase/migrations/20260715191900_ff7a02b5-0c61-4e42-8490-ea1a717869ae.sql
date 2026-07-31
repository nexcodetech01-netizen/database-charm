
ALTER TABLE public.bella_pay_config
  ADD COLUMN IF NOT EXISTS credit_card_absorb_fee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_card_fee_percent numeric(6,3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_card_max_installments smallint NOT NULL DEFAULT 3;

ALTER TABLE public.bella_pay_config
  ADD CONSTRAINT bella_pay_config_cc_max_installments_chk
  CHECK (credit_card_max_installments BETWEEN 1 AND 3);

ALTER TABLE public.bella_pay_charges
  ADD COLUMN IF NOT EXISTS installment_count smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS installment_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS original_value numeric(12,2);

ALTER TABLE public.bella_pay_charges
  ADD CONSTRAINT bella_pay_charges_installment_count_chk
  CHECK (installment_count BETWEEN 1 AND 12);
