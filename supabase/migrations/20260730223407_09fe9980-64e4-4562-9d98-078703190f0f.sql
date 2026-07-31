CREATE UNIQUE INDEX IF NOT EXISTS fiscal_documents_one_active_per_sale
  ON public.fiscal_documents (sale_id)
  WHERE sale_id IS NOT NULL
    AND status IN ('draft','validating','signing','sending','authorized');

COMMENT ON INDEX public.fiscal_documents_one_active_per_sale IS
  'Impede mais de uma NF-e ativa por venda. Cancelados/rejeitados/erro/descartados nao bloqueiam reemissao.';