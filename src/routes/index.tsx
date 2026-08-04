import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isPreviewHostname } from "@/hooks/version-check.utils";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ request }) => {
    // Detect environment on server via request headers
    const url = new URL(request.url);
    const host = request.headers.get("host") || url.hostname;
    
    // No ambiente de preview do Lovable, evitamos o throw redirect imediato no SSR
    // que causa 502/Internal Server Error devido ao processamento de query params (?source=pwa).
    if (isPreviewHostname(host)) {
      console.log("[SSR] Preview environment detected via Host header. Skipping immediate redirect.");
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
  const navigate = useNavigate();
  
  useEffect(() => {
    if (typeof window !== "undefined" && isPreviewHostname(window.location.hostname)) {
      const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate({ to: "/dashboard" });
        } else {
          navigate({ to: "/auth" });
        }
      };
      void checkSession();
    }
  }, [navigate]);

  return null;
}
