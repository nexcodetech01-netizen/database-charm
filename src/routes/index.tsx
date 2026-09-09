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

    // Anonymous visitors go to the login/sign-up gate.
    throw redirect({ to: "/auth" });
  },
});
