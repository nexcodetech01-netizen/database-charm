-- Migration: Fix Consignment RLS JWT Bug
-- Description: Replaces the broken (auth.jwt() ->> 'company_id')::uuid checks with public.user_owns_company(company_id)
-- Date: 2026-08-19 17:20:00

-- 1. Resellers
DROP POLICY IF EXISTS "Users can manage resellers of their company" ON public.resellers;
DROP POLICY IF EXISTS "resellers_policy" ON public.resellers;
CREATE POLICY "resellers_policy" ON public.resellers
    FOR ALL
    TO authenticated
    USING (public.user_owns_company(company_id))
    WITH CHECK (public.user_owns_company(company_id));

-- 2. Consignacoes
DROP POLICY IF EXISTS "Users can manage consignacoes of their company" ON public.consignacoes;
DROP POLICY IF EXISTS "consignacoes_policy" ON public.consignacoes;
CREATE POLICY "consignacoes_policy" ON public.consignacoes
    FOR ALL
    TO authenticated
    USING (public.user_owns_company(company_id))
    WITH CHECK (public.user_owns_company(company_id));

-- 3. Consignment Items
DROP POLICY IF EXISTS "Users can manage consignment_items of their company" ON public.consignment_items;
DROP POLICY IF EXISTS "consignment_items_policy" ON public.consignment_items;
CREATE POLICY "consignment_items_policy" ON public.consignment_items
    FOR ALL
    TO authenticated
    USING (public.user_owns_company(company_id))
    WITH CHECK (public.user_owns_company(company_id));

-- 4. Consignment Settlements
DROP POLICY IF EXISTS "Users can manage consignment_settlements of their company" ON public.consignment_settlements;
DROP POLICY IF EXISTS "consignment_settlements_policy" ON public.consignment_settlements;
CREATE POLICY "consignment_settlements_policy" ON public.consignment_settlements
    FOR ALL
    TO authenticated
    USING (public.user_owns_company(company_id))
    WITH CHECK (public.user_owns_company(company_id));