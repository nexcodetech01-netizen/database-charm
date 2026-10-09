import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NexOS — Gestão empresarial" },
      { name: "description", content: "Acesse o NexOS para gerenciar vendas, produtos e finanças da sua empresa." },
      { property: "og:title", content: "NexOS — Gestão empresarial" },
      { property: "og:description", content: "Acesse a gestão de vendas, produtos e finanças no NexOS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();

    // If authenticated, go to dashboard
    if (data.user) {
      throw redirect({ to: "/dashboard" });
    }

    // Anonymous visitors go to the login/sign-up gate.
    throw redirect({ to: "/auth" });
  },
});
