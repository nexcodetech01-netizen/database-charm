-- Migração: Automação de Contas a Receber para Vendas com Pagamento Pendente
-- Objetivo: Eliminar o limbo entre venda entregue e pagamento recebido.

-- 1. Função RPC para garantir que uma venda tenha um título no Contas a Receber se não foi paga no ato
create or replace function public.ensure_sale_receivable(_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_sale record;
    v_company_id uuid;
    v_exists boolean;
    v_customer_id uuid;
begin
    -- Busca dados da venda
    select * into v_sale from public.sales where id = _sale_id;
    if not found then return; end if;

    -- Se já tem método de pagamento definido (venda paga no ato), não faz nada
    -- O fluxo de vendas pagas continua via financial_transactions imediatas.
    if v_sale.payment_method is not null then
        return;
    end if;

    -- Verifica se já existe um título em contas a receber para esta venda
    select exists (
        select 1 from public.financial_transactions 
        where reference_id = _sale_id 
          and source = 'sale' 
          and direction = 'in'
          and status = 'pending'
    ) into v_exists;

    if v_exists then
        return;
    end if;

    -- Cria o título em Contas a Receber (financial_transactions)
    insert into public.financial_transactions (
        company_id,
        direction,
        status,
        amount,
        description,
        source,
        reference_id,
        customer_id,
        due_at,
        created_at
    ) values (
        v_sale.company_id,
        'in',
        'pending',
        v_sale.grand_total,
        'Venda #' || v_sale.number || ' (Pagamento Pendente)',
        'sale',
        v_sale.id,
        v_sale.customer_id,
        now(),
        now()
    );
end;
$$;

-- 2. Trigger para disparar a automação após inserção ou atualização de venda
create or replace function public.trg_auto_ensure_sale_receivable_func()
returns trigger
language plpgsql
security definer
as $$
begin
    -- Dispara apenas se o status for finalizado (pending ou paid) e não houver método de pagamento
    if (new.status in ('pending', 'paid')) and (new.payment_method is null) then
        perform public.ensure_sale_receivable(new.id);
    end if;
    return new;
end;
$$;

drop trigger if exists trg_auto_ensure_sale_receivable on public.sales;
create trigger trg_auto_ensure_sale_receivable
after insert or update of status, payment_method on public.sales
for each row execute function public.trg_auto_ensure_sale_receivable_func();

GRANT EXECUTE ON FUNCTION public.ensure_sale_receivable(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_sale_receivable(uuid) TO service_role;
