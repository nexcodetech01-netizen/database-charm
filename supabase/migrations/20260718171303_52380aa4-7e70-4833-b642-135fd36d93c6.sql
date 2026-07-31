CREATE OR REPLACE FUNCTION public.bella_pay_record_webhook_event(_company_id uuid, _asaas_event_id text, _event_type text, _payment_id text, _request_id text, _payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_charge record;
  v_event_id uuid;
begin
  if _payment_id is not null then
    select id, company_id, customer_id, sale_id, financial_transaction_id,
           description, value, status,
           installment_value, installment_count
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
$function$;