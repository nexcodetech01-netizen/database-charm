import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * DIAGNÓSTICO E CORREÇÃO FORÇADA DE BUILD (REVERTER ERRO DE SINTAXE)
 *
 * O build de produção está falhando em loop. Precisamos identificar o arquivo exato que está quebrando a compilação:
 *
 * 1. EXECUTE O CHEQUE DE TIPOS:
 *    - Execute o comando `npx tsc --noEmit` no terminal para expor a linha e o arquivo exato onde está o erro de TypeScript ou sintaxe.
 *
 * 2. CORRIJA OU REVERTA O COMPONENTE QUEBRADO:
 *    - Identifique qual arquivo modificado recentemente (notificações, modal ou calculadora de frete) possui importação inválida, tag JSX não fechada ou erro de tipagem.
 *    - Reconstrua esse arquivo de forma limpa e simples para garantir que a compilação volte a passar.
 *
 * 3. CONFIRME O BUILD:
 *    - Rode o comando `npm run build` no terminal integrado até que ele finalize com sucesso (exit status 0) antes de tentar publicar novamente.
 */

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    
    if (data.user) {
      throw redirect({ to: "/dashboard" });
    }
    
    throw redirect({ to: "/auth" });
  },
});

