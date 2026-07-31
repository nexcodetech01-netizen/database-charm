ALTER TABLE public.bella_pay_config
  ADD COLUMN IF NOT EXISTS default_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.bella_pay_apply_webhook_result(_event_id uuid, _intent jsonb, _finalize jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_charge_id uuid          := nullif(_intent->>'charge_id','')::uuid;
  v_sale_id uuid            := nullif(_intent->>'sale_id','')::uuid;
  v_company_id uuid         := nullif(_intent->>'company_id','')::uuid;
  v_existing_ft_id uuid     := nullif(_intent->>'existing_ft_id','')::uuid;
  v_settle boolean          := coalesce((_intent->>'settle_finance')::boolean, false);
  v_payment_value numeric   := coalesce((_intent->>'payment_value')::numeric, 0);
  v_payment_id_ext text     := _intent->>'payment_id_ext';
  v_paid_at timestamptz     := nullif(_intent->>'paid_at','')::timestamptz;
  v_tx_date date            := nullif(_intent->>'transaction_date','')::date;
  v_description text        := _intent->>'description';
  v_patch jsonb             := coalesce(_intent->'charge_patch','{}'::jsonb);
  v_payment_method text     := coalesce(nullif(_intent->>'payment_method',''), 'card_gateway');

  v_ft_id uuid              := v_existing_ft_id;
  v_sale_promoted boolean   := false;
  v_finance_ref uuid;
  v_account_id uuid;
  v_ft_status text;
  v_settled boolean         := false;
  v_error text              := nullif(_finalize->>'error','');
  v_warnings_arr text[];
begin
  -- Charge patch
  if v_charge_id is not null and v_patch <> '{}'::jsonb then
    update public.bella_pay_charges
       set status      = coalesce(nullif(v_patch->>'status',''), status),
           paid_at     = coalesce(nullif(v_patch->>'paid_at','')::timestamptz, paid_at),
           canceled_at = coalesce(nullif(v_patch->>'canceled_at','')::timestamptz, canceled_at)
     where id = v_charge_id;
  end if;

  if v_settle and v_charge_id is not null then
    select default_account_id into v_account_id
      from public.bella_pay_config
     where company_id = v_company_id
     limit 1;

    -- Resolve o recebível da venda (ou cria o avulso quando não há venda)
    if v_sale_id is not null then
      select finance_ref into v_finance_ref from public.sales where id = v_sale_id;
      if v_finance_ref is not null and v_finance_ref is distinct from v_ft_id then
        v_ft_id := v_finance_ref;
        update public.bella_pay_charges
           set financial_transaction_id = v_ft_id
         where id = v_charge_id;
      end if;
    elsif v_ft_id is null and v_payment_value > 0 then
      insert into public.financial_transactions(
        company_id, type, status, amount, transaction_date, paid_at,
        description, source, reference_id, reference_number,
        asaas_charge_id, bella_pay_charge_id
      ) values (
        v_company_id, 'income', 'pending', v_payment_value,
        coalesce(v_tx_date, current_date), null,
        coalesce(nullif(v_description,''),
                 'Recebimento Bella Pay ' || coalesce(v_payment_id_ext,'')),
        'bella_pay', v_charge_id, v_payment_id_ext,
        v_payment_id_ext, v_charge_id
      )
      returning id into v_ft_id;

      update public.bella_pay_charges
         set financial_transaction_id = v_ft_id
       where id = v_charge_id;
    end if;

    if v_account_id is null then
      v_error := coalesce(v_error || ' | ', '')
        || 'CONFIG_BELLA_PAY: conta financeira padrão (default_account_id) não configurada em Bella Pay. Recebível mantido pendente e venda não marcada como paga.';
    elsif v_ft_id is null then
      v_error := coalesce(v_error || ' | ', '')
        || 'BELLA_PAY: recebível financeiro da venda não encontrado. Venda não marcada como paga.';
    else
      select status into v_ft_status from public.financial_transactions where id = v_ft_id;

      if v_ft_status = 'paid' then
        v_settled := true;
      else
        begin
          perform public.settle_financial_transaction(
            v_ft_id,
            v_payment_method,
            v_account_id,
            coalesce(v_paid_at, now())::date,
            'Bella Pay ' || coalesce(v_payment_id_ext, '')
          );
          v_settled := true;
        exception when others then
          v_settled := false;
          v_error := coalesce(v_error || ' | ', '')
            || 'BELLA_PAY_SETTLE: ' || SQLERRM;
        end;
      end if;
    end if;

    -- A venda só é promovida a 'paid' após a liquidação financeira
    if v_settled and v_sale_id is not null then
      update public.sales
         set status = 'paid',
             paid_at = coalesce(v_paid_at, now()),
             payment_confirmed_at = now()
       where id = v_sale_id and status <> 'paid';
      v_sale_promoted := found;
    end if;
  end if;

  -- Finalize event
  if _event_id is not null then
    v_warnings_arr := case
      when _finalize ? 'warnings' and jsonb_typeof(_finalize->'warnings') = 'array'
      then array(select jsonb_array_elements_text(_finalize->'warnings'))
      else null
    end;

    update public.bella_pay_webhook_events
       set processed = true,
           processed_at = now(),
           financial_transaction_id = v_ft_id,
           charge_status = nullif(_finalize->>'charge_status',''),
           transition_rejected = coalesce((_finalize->>'transition_rejected')::boolean, false),
           value_mismatch = coalesce((_finalize->>'value_mismatch')::boolean, false),
           warnings = case when v_warnings_arr is not null and array_length(v_warnings_arr,1) > 0
                           then to_jsonb(v_warnings_arr) else null end,
           error = v_error
     where id = _event_id;
  end if;

  return jsonb_build_object(
    'salePromoted', v_sale_promoted,
    'financialTransactionId', v_ft_id,
    'settled', v_settled,
    'error', v_error
  );
end;
$function$;