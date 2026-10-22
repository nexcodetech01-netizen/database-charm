-- =====================================================================
-- Lote de segurança — auditoria 2026-10-22 (itens 1.3, 1.4, 1.8, 1.9)
--
-- Aplicar DEPOIS que o código deste mesmo PR estiver publicado: a partir
-- daqui o navegador não lê mais as chaves do Asaas, e o código novo já lê
-- e grava as chaves só pelo servidor (service role).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1.3  Chaves do Asaas: o navegador não lê nem grava mais api_key_*.
--      O servidor (service role) continua com acesso total.
-- ---------------------------------------------------------------------
revoke select, insert, update on public.bella_pay_config from authenticated, anon;

grant select (id, company_id, environment, connection_status, connection_message, last_tested_at,
              credit_card_absorb_fee, credit_card_fee_percent, credit_card_max_installments,
              default_account_id, webhook_token, created_at, updated_at)
  on public.bella_pay_config to authenticated;

grant insert (company_id, environment, connection_status, connection_message, last_tested_at,
              credit_card_absorb_fee, credit_card_fee_percent, credit_card_max_installments,
              default_account_id)
  on public.bella_pay_config to authenticated;

grant update (company_id, environment, connection_status, connection_message, last_tested_at,
              credit_card_absorb_fee, credit_card_fee_percent, credit_card_max_installments,
              default_account_id, updated_at)
  on public.bella_pay_config to authenticated;

-- ---------------------------------------------------------------------
-- 1.4a  Função sem uso que reescrevia o preço de QUALQUER produto e era
--       executável até por visitante anônimo (sem GRANT/REVOKE explícito).
--       Nenhuma função atual a chama (desde 20260916130000).
-- ---------------------------------------------------------------------
drop function if exists public.recalculate_product_v2_price(uuid);

-- ---------------------------------------------------------------------
-- 1.4b  find_products_by_name_key: devolvia produtos (com custo) de qualquer
--       empresa. Agora exige vínculo com a empresa (ou service role).
-- ---------------------------------------------------------------------
create or replace function public.find_products_by_name_key(
  company_id_param uuid,
  name_param text,
  limit_param int default 5
)
returns setof public.products
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.role() is distinct from 'service_role'
     and not public.user_has_company_access(company_id_param) then
    raise exception 'Sem acesso à empresa.' using errcode = '42501';
  end if;

  if public.product_name_key(name_param) is null then
    return;
  end if;

  return query
  select p.*
    from public.products p
   where p.company_id = company_id_param
     and p.status = 'active'
     and public.product_name_key(p.name) = public.product_name_key(name_param)
   order by p.created_at asc
   limit limit_param;
end;
$$;

revoke execute on function public.find_products_by_name_key(uuid, text, int) from public, anon;
grant execute on function public.find_products_by_name_key(uuid, text, int) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1.4c  refresh_kit_stock: anônimo não executa mais; search_path fixo.
--       (Continua liberada para authenticated: os triggers de kit a chamam.)
--       + SECURITY DEFINER sem search_path fixo.
-- ---------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.refresh_kit_stock(uuid)') is not null then
    execute 'revoke execute on function public.refresh_kit_stock(uuid) from public, anon';
    execute 'grant execute on function public.refresh_kit_stock(uuid) to authenticated, service_role';
    execute 'alter function public.refresh_kit_stock(uuid) set search_path = public';
  end if;
  if to_regprocedure('public.trg_auto_ensure_sale_receivable_func()') is not null then
    execute 'alter function public.trg_auto_ensure_sale_receivable_func() set search_path = public';
  end if;
  if to_regprocedure('public.trg_notify_finance_overview_on_account_change()') is not null then
    execute 'alter function public.trg_notify_finance_overview_on_account_change() set search_path = public';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 1.8  query_metrics: a correção 20260820000000 apagou políticas com nome
--      errado; estas duas (USING true) seguiam liberando tudo entre empresas.
--      Ficam valendo query_metrics_select / query_metrics_insert (por empresa).
-- ---------------------------------------------------------------------
drop policy if exists "Authenticated users can view metrics" on public.query_metrics;
drop policy if exists "Authenticated users can insert metrics" on public.query_metrics;

-- ---------------------------------------------------------------------
-- 1.9  Coleções: visitante anônimo lia todas as colunas (inclusive
--      company_id de todas as lojas). As páginas públicas do catálogo leem
--      pelo servidor (service role) e não dependem disso.
-- ---------------------------------------------------------------------
drop policy if exists "Anonymous can view active collections" on public.product_collections;
drop policy if exists "Anonymous can view items of active collections" on public.product_collection_items;
revoke select on public.product_collections from anon;
revoke select on public.product_collection_items from anon;

commit;
