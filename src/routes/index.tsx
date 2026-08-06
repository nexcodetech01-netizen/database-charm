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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Bolsa Social Feminina com Monograma</h1>
        <p className="text-muted-foreground">Ideal para quem busca estilo, praticidade e elegância no dia a dia.</p>
        <div className="mt-8 p-6 border rounded-lg bg-card text-card-foreground shadow-sm">
          <div className="space-y-6 text-sm leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold mb-2">ESPECIFICAÇÕES:</h2>
              <ul className="list-none space-y-1 text-muted-foreground">
                <li>• Material: Sintético de alta qualidade</li>
                <li>• Fechamento: Zíper resistente</li>
                <li>• Alça: De ombro</li>
                <li>• Estilo: Social / Casual</li>
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-semibold mb-2">CONTEÚDO DA EMBALAGEM:</h2>
              <ul className="list-none space-y-1 text-muted-foreground">
                <li>• 1x Bolsa Social Feminina Monograma</li>
              </ul>
            </section>
            <section>
              <h2 className="text-lg font-semibold mb-2">CUIDADOS:</h2>
              <p className="text-muted-foreground">Limpeza com pano úmido e sabão neutro. Secar à sombra.</p>
            </section>
            <section>
              <h2 className="text-lg font-semibold mb-2">GARANTIA:</h2>
              <p className="text-muted-foreground">30 dias contra defeitos de fabricação.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}