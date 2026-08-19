create table public.query_metrics (
    id uuid primary key default gen_random_uuid(),
    query_name text not null,
    payload_size_kb numeric(10,2) not null,
    company_id uuid references public.companies(id),
    created_at timestamptz default now()
);

grant insert, select on public.query_metrics to authenticated;
grant all on public.query_metrics to service_role;

alter table public.query_metrics enable row level security;

create policy "Users can view metrics for their company"
on public.query_metrics for select
to authenticated
using (company_id::text = (auth.jwt() ->> 'company_id'));

create policy "Users can insert metrics for their company"
on public.query_metrics for insert
to authenticated
with check (company_id::text = (auth.jwt() ->> 'company_id'));