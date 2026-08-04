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
      <div className="max-w-2xl space-y-8 text-center">
        <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
          WhatsApp 24h Window Management
        </h1>
        
        <div className="p-6 text-left border rounded-lg bg-card shadow-sm space-y-4">
          <p className="font-semibold text-lg">Backend & Database Infrastructure Implemented:</p>
          
          <ul className="space-y-3 list-disc list-inside text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Database:</span> Added <code>ultima_mensagem_cliente_at</code> to <code>whatsapp_contacts</code> and <code>whatsapp_conversations</code>.
            </li>
            <li>
              <span className="font-medium text-foreground">Webhook:</span> Updated <code>handleWhatsAppInboundPayload</code> to automatically refresh window timestamps on every incoming message.
            </li>
            <li>
              <span className="font-medium text-foreground">Smart Delivery:</span> Refactored <code>sendOperatorMessage</code> with 24h window logic. Automatically switches between <code>text</code> and <code>template</code> (boas_vindas) based on window status.
            </li>
            <li>
              <span className="font-medium text-foreground">UI Indicators:</span> Created <code>WhatsAppWindowIndicator</code> component for real-time visual feedback on conversation status (Open vs Expired).
            </li>
          </ul>
        </div>

        <div className="flex justify-center pt-4">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-500 text-sm font-medium border border-emerald-500/20">
            <span className="relative flex h-2 w-2 mr-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Infrastructure Ready
          </div>
        </div>
      </div>
    </div>
  );
}
