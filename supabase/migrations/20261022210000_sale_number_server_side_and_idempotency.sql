-- =====================================================================
-- Número de venda gerado no banco + chave anti-duplicata (auditoria 4.1)
--
-- PROBLEMA: o número da venda era gerado no navegador com precisão de
-- minuto ("VD-AAAAMMDD-HHMM") ou segundo ("PDV-AAAAMMDD-HHMMSS"). Duas vendas
-- da mesma empresa no mesmo minuto colidiam no UNIQUE(company_id, number) e
-- o app tratava "mesmo número + mesmo total" como reenvio — a segunda venda
-- era DESCARTADA em silêncio.
--
-- SOLUÇÃO:
--  1. Contador por empresa e por dia (fuso da empresa). Formato:
--     VD-AAAAMMDD-0001 (recomeça todo dia).
--  2. Trigger BEFORE INSERT em `sales`: quando o número vem vazio ou no
--     formato automático antigo gerado pelo navegador, o banco substitui pelo
--     próximo número do contador. Números digitados manualmente (ou de
--     integrações, ex. "ML-…") são mantidos.
--  3. Coluna `client_request_id` (UUID gerado pelo app por tentativa de venda)
--     com índice único por empresa: um reenvio após queda de rede é
--     reconhecido pela chave, não mais por "número + total".
--
-- APLICAR ANTES de publicar o código do mesmo PR (o código novo envia
-- `client_request_id`, que precisa existir).
-- =====================================================================

begin;

-- 1) Contador ---------------------------------------------------------------
create table if not exists public.sale_number_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  day date not null,
  last_value integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (company_id, day)
);

alter table public.sale_number_counters enable row level security;
-- Sem políticas de propósito: só a função SECURITY DEFINER abaixo mexe aqui.
revoke all on public.sale_number_counters from anon, authenticated;
grant all on public.sale_number_counters to service_role;

-- 2) Próximo número ---------------------------------------------------------
create or replace function public.next_sale_number(_company_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_day date;
  v_seq integer;
  v_candidate text;
  v_guard integer := 0;
begin
  if _company_id is null then
    raise exception 'company_id obrigatório' using errcode = '22004';
  end if;

  select coalesce(nullif(trim(c.timezone), ''), 'America/Sao_Paulo')
    into v_tz
    from public.companies c
   where c.id = _company_id;
  v_tz := coalesce(v_tz, 'America/Sao_Paulo');
  v_day := (now() at time zone v_tz)::date;

  loop
    -- Linha do contador travada por empresa/dia: concorrência serializada,
    -- nunca dois números iguais.
    insert into public.sale_number_counters as c (company_id, day, last_value)
    values (_company_id, v_day, 1)
    on conflict (company_id, day)
    do update set last_value = c.last_value + 1, updated_at = now()
    returning c.last_value into v_seq;

    v_candidate := 'VD-' || to_char(v_day, 'YYYYMMDD') || '-'
                   || case when v_seq < 10000 then lpad(v_seq::text, 4, '0') else v_seq::text end;

    -- No dia da implantação podem existir números antigos no mesmo formato
    -- (ex.: "VD-20261022-1745" = 17:45). Pula se já existir.
    exit when not exists (
      select 1 from public.sales s
       where s.company_id = _company_id and s.number = v_candidate
    );

    v_guard := v_guard + 1;
    if v_guard > 10000 then
      raise exception 'Não foi possível gerar número de venda livre.';
    end if;
  end loop;

  return v_candidate;
end;
$$;

revoke execute on function public.next_sale_number(uuid) from public, anon, authenticated;
grant execute on function public.next_sale_number(uuid) to service_role;

-- 3) Trigger em sales -------------------------------------------------------
create or replace function public.trg_assign_sale_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.number is null
     or btrim(new.number) = ''
     -- formatos automáticos antigos gerados no navegador:
     or new.number ~ '^VD-[0-9]{8}-[0-9]{4}$'          -- VD-AAAAMMDD-HHMM
     or new.number ~ '^PDV-[0-9]{8}-[0-9]{6}$'         -- PDV-AAAAMMDD-HHMMSS
     or new.number ~ '^PDV-[0-9]{8}-[0-9]{6}-[0-9]{3}$' -- retry antigo com sufixo
     or new.number ~ '^VD-[0-9]{8}-[0-9]{4}-[0-9]{3}$'
  then
    new.number := public.next_sale_number(new.company_id);
  end if;
  return new;
end;
$$;

revoke execute on function public.trg_assign_sale_number() from public, anon, authenticated;

drop trigger if exists trg_zz_assign_sale_number on public.sales;
create trigger trg_zz_assign_sale_number
  before insert on public.sales
  for each row execute function public.trg_assign_sale_number();

-- 4) Chave anti-duplicata ---------------------------------------------------
alter table public.sales add column if not exists client_request_id uuid;

create unique index if not exists sales_company_client_request_uidx
  on public.sales (company_id, client_request_id)
  where client_request_id is not null;

commit;
