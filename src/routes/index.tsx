import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    // 1. Executar supabase.auth.getSession() (via getUser para segurança extra do token)
    const { data } = await supabase.auth.getUser();

    if (data.user) {
      // 2. Se existir sessão válida: Redirecionar para o Dashboard
      throw redirect({ to: "/dashboard" });
    }

    // 3. Se NÃO existir sessão: Redirecionar para o fluxo de Login
    throw redirect({ to: "/auth" });
  },
  component: () => null, // O componente nunca renderiza devido ao redirect
});
