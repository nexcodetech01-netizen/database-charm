-- =====================================================================
-- Criação atômica de venda + itens (auditoria 4.1, parte 3)
--
-- Antes, o navegador gravava a venda e os itens em requisições separadas.
-- Se a rede caísse entre uma e outra, sobrava uma venda sem itens (o app
-- tentava desfazer com delete_sale, mas o desfazer também podia falhar).
--
-- Agora `create_sale_with_items` grava os dois na MESMA transação: ou tudo
-- é gravado, ou nada. Roda com as permissões do usuário (SECURITY INVOKER),
-- então RLS e todos os triggers existentes continuam valendo exatamente
-- como no INSERT direto.
--
-- Semântica igual ao INSERT do PostgREST: só as colunas presentes no JSON
-- são gravadas; as ausentes usam o DEFAULT da tabela (e os triggers, como
-- o número da venda e a data operacional, continuam preenchendo).
--
-- Reenvio com a mesma `client_request_id`: devolve a venda já gravada
-- (com itens) em vez de duplicar.
-- =====================================================================

begin;

create or replace function public.create_sale_with_items(_header jsonb, _items jsonb)
returns public.sales
language plpgsql
volatile
security invoker
set search_path = public
as $$
declare
  v_sale public.sales%rowtype;
  v_sale_cols text;
  v_item_cols text;
  v_items jsonb;
  v_company uuid;
  v_request uuid;
begin
  if _header is null or jsonb_typeof(_header) <> 'object' then
    raise exception 'Cabeçalho da venda inválido.' using errcode = '22023';
  end if;
  if _items is null or jsonb_typeof(_items) <> 'array' or jsonb_array_length(_items) = 0 then
    raise exception 'A venda precisa ter ao menos um item.' using errcode = '22023';
  end if;

  v_company := nullif(_header ->> 'company_id', '')::uuid;
  v_request := nullif(_header ->> 'client_request_id', '')::uuid;

  -- Reenvio: a venda com esta chave já existe (e é visível para o usuário).
  if v_request is not null then
    select * into v_sale
      from public.sales s
     where s.company_id = v_company and s.client_request_id = v_request;
    if found then
      if exists (select 1 from public.sale_items si where si.sale_id = v_sale.id) then
        return v_sale;
      end if;
      -- Venda sem itens (legado do fluxo antigo): completa os itens abaixo.
    end if;
  end if;

  if v_sale.id is null then
    -- Colunas presentes no JSON que existem em `sales` (e não são geradas).
    select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
      into v_sale_cols
      from pg_attribute a
     where a.attrelid = 'public.sales'::regclass
       and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
       and _header ? a.attname;

    begin
      execute format(
        'insert into public.sales (%1$s) select %1$s from jsonb_populate_record(null::public.sales, $1) returning *',
        v_sale_cols
      ) using _header into v_sale;
    exception when unique_violation then
      -- Corrida entre duas tentativas com a mesma chave: devolve a vencedora.
      if v_request is not null then
        select * into v_sale
          from public.sales s
         where s.company_id = v_company and s.client_request_id = v_request;
        if found and exists (select 1 from public.sale_items si where si.sale_id = v_sale.id) then
          return v_sale;
        end if;
      end if;
      raise;
    end;
  end if;

  -- Itens: força o sale_id da venda recém-criada.
  select jsonb_agg(e || jsonb_build_object('sale_id', v_sale.id))
    into v_items
    from jsonb_array_elements(_items) e;

  select string_agg(quote_ident(a.attname), ', ' order by a.attnum)
    into v_item_cols
    from pg_attribute a
   where a.attrelid = 'public.sale_items'::regclass
     and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
     and exists (select 1 from jsonb_array_elements(v_items) e where e ? a.attname);

  execute format(
    'insert into public.sale_items (%1$s) select %1$s from jsonb_populate_recordset(null::public.sale_items, $1)',
    v_item_cols
  ) using v_items;

  -- Relê a venda (triggers dos itens podem ter atualizado colunas).
  select * into v_sale from public.sales where id = v_sale.id;
  return v_sale;
end;
$$;

revoke execute on function public.create_sale_with_items(jsonb, jsonb) from public, anon;
grant execute on function public.create_sale_with_items(jsonb, jsonb) to authenticated, service_role;

commit;
