-- FIX — view_cash_session_summary excluía movimentações de "baixa
-- financeira" por comparação EXATA de texto, mas o motivo real tem um
-- sufixo (ex.: "Baixa financeira — Baixa automática PDV").
--
-- Achado real (2026-08-18, com o relatório de fechamento em mãos): o
-- "dinheiro esperado" do fechamento de caixa (R$296,99) não batia com
-- o dinheiro contado (R$121,00) — mas o valor contado estava CERTO
-- (saldo inicial R$86 + vendas em dinheiro reais R$35 = R$121, bate
-- exatamente). O erro era 100% do cálculo do sistema.
--
-- Causa: a migration 20260813114500 (fix_cash_summary_exclude_test_sales)
-- já tentava excluir movimentações automáticas de "baixa financeira" do
-- cálculo de Suprimentos/Sangrias manuais — essas movimentações são só
-- informativas (mostram cada venda sendo "baixada" financeiramente),
-- não representam dinheiro físico de verdade entrando/saindo da gaveta.
-- Só que o filtro comparava o motivo por IGUALDADE EXATA
-- (`reason NOT IN ('baixa financeira', ...)`), e o motivo real gravado
-- em cada movimento tem um sufixo depois de um travessão (ex.: "Baixa
-- financeira — Baixa automática PDV", "Baixa financeira — Comissão
-- ML") — a comparação exata nunca batia (nem a capitalização "Baixa"
-- vs "baixa" batia), então essas movimentações automáticas eram
-- contadas como se fossem suprimentos/sangrias manuais de verdade.
-- Resultado: TODA venda (inclusive as pagas em Pix, que nunca deveriam
-- afetar o dinheiro físico esperado) inflava o "dinheiro esperado" —
-- exatamente o valor da diferença que apareceu no fechamento.
--
-- Fix: comparação por PREFIXO (case-insensitive) em vez de igualdade
-- exata, cobrindo o motivo com ou sem o sufixo depois do travessão.

CREATE OR REPLACE VIEW public.view_cash_session_summary AS
WITH session_sales_stats AS (
    SELECT cash_session_id, COUNT(*) as sales_count
    FROM public.sales
    WHERE status IN ('paid', 'partially_paid')
      AND NOT COALESCE(is_test, false)
    GROUP BY cash_session_id
),
session_receipts AS (
    SELECT
        COALESCE(settlement_session_id, (
            SELECT id FROM public.cash_sessions cs
            WHERE ft.company_id = cs.company_id
              AND ft.paid_at >= cs.opened_at
              AND (cs.closed_at IS NULL OR ft.paid_at <= cs.closed_at)
            ORDER BY cs.opened_at DESC LIMIT 1
        )) as session_id,
        SUM(amount) as total_received,
        SUM(CASE WHEN payment_method = 'cash' THEN amount ELSE 0 END) as cash_received
    FROM public.financial_transactions ft
    LEFT JOIN public.sales s ON s.id = ft.reference_id AND ft.source = 'sale'
    WHERE ft.status = 'paid' AND ft.type = 'income'
      AND NOT COALESCE(s.is_test, false)
    GROUP BY 1
),
session_movements AS (
    SELECT
        session_id,
        SUM(CASE
              WHEN type = 'cash_in'
                AND lower(trim(reason)) NOT LIKE 'baixa financeira%'
                AND lower(trim(reason)) NOT LIKE 'saneamento de baixa%'
                AND lower(trim(reason)) NOT LIKE 'estorno de baixa financeira%'
              THEN amount ELSE 0
            END) as manual_in,
        SUM(CASE
              WHEN type = 'cash_out'
                AND lower(trim(reason)) NOT LIKE 'baixa financeira%'
                AND lower(trim(reason)) NOT LIKE 'saneamento de baixa%'
                AND lower(trim(reason)) NOT LIKE 'estorno de baixa financeira%'
              THEN amount ELSE 0
            END) as manual_out
    FROM public.cash_movements
    GROUP BY session_id
)
SELECT
    cs.id as session_id,
    cs.company_id,
    cs.status as session_status,
    cs.opening_balance,
    COALESCE(sr.total_received, 0) as sales_total,
    COALESCE(ss.sales_count, 0) as sales_count,
    COALESCE(sm.manual_in, 0) as cash_in,
    COALESCE(sm.manual_out, 0) as cash_out,
    COALESCE(sr.cash_received, 0) as cash_sales,
    (cs.opening_balance + COALESCE(sr.cash_received, 0) + COALESCE(sm.manual_in, 0) - COALESCE(sm.manual_out, 0)) as expected_cash,
    cs.opened_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo' as opened_at_local
FROM public.cash_sessions cs
LEFT JOIN session_sales_stats ss ON ss.cash_session_id = cs.id
LEFT JOIN session_receipts sr ON sr.session_id = cs.id
LEFT JOIN session_movements sm ON sm.session_id = cs.id;

GRANT SELECT ON public.view_cash_session_summary TO authenticated;
GRANT SELECT ON public.view_cash_session_summary TO service_role;
