import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * CORREÇÃO DE ERRO DE COMPILAÇÃO E BUILD (VITE / PUBLISHING FAILED)
 *
 * O publish falhou no estágio de "rendering chunks" com erro no script de build. 
 *
 * Por favor, faça uma varificação completa para corrigir essa falha:
 *
 * 1. DIAGNÓSTICO DE SINTAXE E TIPOS:
 *    - Verifique os componentes e arquivos modificados recentemente (notificações, modal, frete e serviços).
 *    - Identifique e corrija qualquer import quebrado, tag JSX mal fechada, variável não declarada ou incompatibilidade de tipos TypeScript.
 *
 * 2. LIMPEZA DE CACHE E COMPILAÇÃO:
 *    - Certifique-se de que não existem erros impeditivos no compilador do Vite / TanStack Start.
 *    - Valide se o comando de build interno encerra com sucesso (exit status 0) para liberar o Publish novamente.
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

