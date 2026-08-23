import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    
    // If authenticated, go to dashboard
    if (data.user) {
      throw redirect({ to: "/dashboard" });
    }
    
    // Public users see the main collection
    throw redirect({ to: "/catalogo/colecao/tg-style-catalogue" });
  },
});
