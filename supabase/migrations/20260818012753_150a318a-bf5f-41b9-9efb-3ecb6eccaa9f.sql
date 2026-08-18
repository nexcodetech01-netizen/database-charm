-- 1. Drop the incorrect foreign keys pointing to the legacy table
ALTER TABLE public.consignment_items 
DROP CONSTRAINT IF EXISTS consignment_items_consignment_id_fkey;

ALTER TABLE public.consignment_settlements 
DROP CONSTRAINT IF EXISTS consignment_settlements_consignment_id_fkey;

-- 2. Create the correct foreign keys pointing to the active 'consignacoes' table
ALTER TABLE public.consignment_items 
ADD CONSTRAINT consignment_items_consignment_id_fkey 
FOREIGN KEY (consignment_id) REFERENCES public.consignacoes(id) ON DELETE CASCADE;

ALTER TABLE public.consignment_settlements 
ADD CONSTRAINT consignment_settlements_consignment_id_fkey 
FOREIGN KEY (consignment_id) REFERENCES public.consignacoes(id) ON DELETE CASCADE;

-- 3. Drop the obsolete 'consignments' table
DROP TABLE IF EXISTS public.consignments;