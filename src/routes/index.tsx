import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isPreviewHostname } from "@/hooks/version-check.utils";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // No servidor (SSR), o process.env.LOVABLE_PREVIEW_HOST está disponível se estivermos no ambiente de preview.
    const isPreview = Boolean(process.env['LOVABLE_PREVIEW_HOST']);
    const host = typeof window !== "undefined" 
      ? window.location.hostname 
      : (process.env['LOVABLE_PREVIEW_HOST'] || "");

    if (isPreview || isPreviewHostname(host)) {
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-foreground">
      <div className="max-w-4xl w-full space-y-8">
        <div className="p-8 border rounded-xl bg-card shadow-2xl space-y-6 font-mono text-sm leading-relaxed overflow-auto max-h-[80vh]">
          <pre className="whitespace-pre-wrap">
{`ESTRUTURA DE ARQUIVOS (src/):

src/
├── components/ (brand, design, layout, ui, pwa)
├── config/ (env, routes)
├── design/ (tokens, tests)
├── features/ (accounting, auth, bella-ai, marketplace, sales, inventory, etc.)
├── hooks/ (use-toast, use-mobile, version-check)
├── integrations/ (supabase)
├── lib/ (ai-gateway, marketplace-sync, mercadolivre, meta, whatsapp, utils)
├── providers/ (auth, theme, app-providers)
├── routes/ (__root, _authenticated, api, index, auth, catalogo)
├── services/ (branding, storage, supabase)
├── types/ (common)
├── router.tsx
├── start.ts
└── styles.css

Total de diretórios principais: 11
Foco em Features: 40+ módulos operacionais.`}
          </pre>
        </div>
      </div>
    </div>
  );
}
