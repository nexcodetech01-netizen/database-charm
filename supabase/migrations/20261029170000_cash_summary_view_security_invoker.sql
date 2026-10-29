-- Alerta do Supabase "Security Definer View" (29/10/2026).
-- A view rodava com as permissões de quem a criou (ignorava o RLS): um
-- usuário logado de uma empresa conseguiria ler o resumo de caixa de outra.
-- Agora roda com as permissões de quem consulta — cada empresa só vê o
-- próprio caixa. O NexOS já filtra pela empresa/sessão; nada muda na tela.
ALTER VIEW public.view_cash_session_summary SET (security_invoker = on);
REVOKE ALL ON public.view_cash_session_summary FROM anon;
