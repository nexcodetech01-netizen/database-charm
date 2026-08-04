import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isPreviewHostname } from "@/hooks/version-check.utils";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // No servidor (SSR), o process.env.LOVABLE_PREVIEW_HOST está disponível se estivermos no ambiente de preview.
    // No cliente, usamos o hostname da janela.
    const host = typeof window !== "undefined" 
      ? window.location.hostname 
      : (process.env['LOVABLE_PREVIEW_HOST'] || "");

    // No ambiente de preview do Lovable, evitamos o throw redirect imediato no SSR
    // que causa 502/Internal Server Error devido ao processamento de query params (?source=pwa).
    if (isPreviewHostname(host)) {
      if (typeof window === "undefined") {
        console.log(`[SSR] Preview environment detected. Host: ${host}. skipping redirect.`);
        console.log(`[SSR] process.env.LOVABLE_PREVIEW_HOST: ${process.env['LOVABLE_PREVIEW_HOST']}`);
        console.log(`[SSR] isPreviewHostname(${host}): ${isPreviewHostname(host)}`);
      }
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
