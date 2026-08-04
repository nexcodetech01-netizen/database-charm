import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isPreviewHostname } from "@/hooks/version-check.utils";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // No ambiente de preview do Lovable, evitamos o throw redirect imediato no SSR
    // que causa 502/Internal Server Error devido ao processamento de query params (?source=pwa).
    // O redirecionamento acontecerá no client-side após a hidratação se necessário.
    if (typeof window !== "undefined" && isPreviewHostname(window.location.hostname)) {
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      throw redirect({ to: "/dashboard" });
    } else {
      throw redirect({ to: "/auth" });
    }
  },
  component: IndexComponent,
});

function IndexComponent() {
  const router = Route.useRouter();
  const { data: { session } } = supabase.auth.useSession();
  
  if (typeof window !== "undefined" && isPreviewHostname(window.location.hostname)) {
    if (session) {
      router.navigate({ to: "/dashboard" });
    } else if (session === null) {
      router.navigate({ to: "/auth" });
    }
  }

  return null;
}
