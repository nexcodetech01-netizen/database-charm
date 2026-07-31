
-- HOTFIX-004D: RPCs para remover dependência de SUPABASE_SERVICE_ROLE_KEY do webhook Bella Pay.
-- Todas SECURITY DEFINER (owner postgres). Nenhuma tabela é aberta para anon; anon apenas
-- executa estas funções. A URL do webhook (/api/public/bella-pay/webhook/{token}) já é o
-- ponto de autenticação: só quem tem o webhook_token consegue chamar operações.

-- 1) resolve_webhook_token: valida token e devolve company_id + config_id.
create or replace function public.bella_pay_resolve_webhook_token(_token text)
returns table(company_id uuid, config_id uuid, environment text)
language sql
stable
security definer
set search_path = public
as $$
  select company_id, id as config_id, environment
    from public.bella_pay_config
   where webhook_token = _token
   limit 1;
$$;

-- 2) record_webhook_event: insere evento (idempotente via UNIQUE em asaas_event_id) e já
-- devolve a charge local correspondente ao payment_id, caso exista. Uma única ida ao DB.
create or replace function public.bella_pay_record_webhook_event(
  _company_id uuid,
  _asaas_event_id text,
  _event_type text,
  _payment_id text,
  _request_id text,
  _payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_charge record;
  v_event_id uuid;
begin
  if _payment_id is not null then
    select id, company_id, customer_id, sale_id, financial_transaction_id,
           description, value, status
      into v_charge
      from public.bella_pay_charges
     where company_id = _company_id and asaas_id = _payment_id
     limit 1;
  end if;

  begin
    insert into public.bella_pay_webhook_events(
      company_id, asaas_event_id, event_type, payment_id,
      bella_pay_charge_id, sale_id, customer_id, request_id, payload
    ) values (
      _company_id, _asaas_event_id, _event_type, _payment_id,
      v_charge.id, v_charge.sale_id, v_charge.customer_id, _request_id, _payload
    )
    returning id into v_event_id;
  exception when unique_violation then
    return jsonb_build_object('duplicate', true, 'event_id', null,
                              'charge', case when v_charge.id is null then null else to_jsonb(v_charge) end);
  end;

  return jsonb_build_object(
    'duplicate', false,
    'event_id', v_event_id,
    'charge', case when v_charge.id is null then null else to_jsonb(v_charge) end
  );
end;
$$;

-- 3) apply_webhook_result: aplica o intent decidido pelo handler TS.
--    _intent (jsonb) contém:
--      charge_id, sale_id, existing_ft_id,
--      charge_patch { status, paid_at, canceled_at },
--      settle_finance (bool),
--      payment_value, payment_id_ext, paid_at, transaction_date, description, company_id
--    _finalize (jsonb) contém:
--      charge_status, transition_rejected, value_mismatch, warnings (text[]), error
create or replace function public.bella_pay_apply_webhook_result(
  _event_id uuid,
  _intent jsonb,
  _finalize jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  v_ft_id uuid              := v_existing_ft_id;
  v_sale_promoted boolean   := false;
  v_finance_ref uuid;
  v_promoted_id uuid;

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
    if v_sale_id is not null then
      update public.sales
         set status = 'paid',
             paid_at = coalesce(v_paid_at, now()),
             payment_confirmed_at = now()
       where id = v_sale_id and status <> 'paid'
       returning id, finance_ref into v_promoted_id, v_finance_ref;

      v_sale_promoted := v_promoted_id is not null;

      if v_finance_ref is null then
        select finance_ref into v_finance_ref
          from public.sales where id = v_sale_id;
      end if;

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
        v_company_id, 'income', 'paid', v_payment_value,
        coalesce(v_tx_date, current_date), coalesce(v_paid_at, now()),
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
           error = nullif(_finalize->>'error','')
     where id = _event_id;
  end if;

  return jsonb_build_object(
    'salePromoted', v_sale_promoted,
    'financialTransactionId', v_ft_id
  );
end;
$$;

-- Blindar e conceder EXECUTE apenas onde precisa. Nenhuma tabela é aberta.
revoke all on function public.bella_pay_resolve_webhook_token(text) from public;
revoke all on function public.bella_pay_record_webhook_event(uuid, text, text, text, text, jsonb) from public;
revoke all on function public.bella_pay_apply_webhook_result(uuid, jsonb, jsonb) from public;

grant execute on function public.bella_pay_resolve_webhook_token(text) to anon, authenticated, service_role;
grant execute on function public.bella_pay_record_webhook_event(uuid, text, text, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.bella_pay_apply_webhook_result(uuid, jsonb, jsonb) to anon, authenticated, service_role;
