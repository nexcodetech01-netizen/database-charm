import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { MERCADOLIVRE_INTEGRATION_QUERY_KEY } from "@/features/settings/central/sections/integracoes-section";

const CALLBACK_ENDPOINT = "/api/public/mercadolivre/oauth/callback";
const REDIRECT_TO = "/configuracoes";

export const Route = createFileRoute("/_authenticated/mercadolivre/callback")({
  head: () => ({
    meta: [
      { title: "Conectando Mercado Livre — NexOS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MercadoLivreCallbackPage,
});

type Status = "loading" | "error";

function MercadoLivreCallbackPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    // Evita disparo duplicado do StrictMode no primeiro attempt.
    if (attempt === 0 && startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    const providerError =
      params.get("error_description") ??
      params.get("error_reason") ??
      params.get("error");

    if (providerError) {
      setStatus("error");
      setErrorMsg(providerError);
      return;
    }
    if (!code || !state) {
      setStatus("error");
      setErrorMsg("Parâmetros de autorização ausentes na URL (code/state).");
      return;
    }

    const controller = new AbortController();
    (async () => {
      try {
        setStatus("loading");
        setErrorMsg(null);
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        const res = await fetch(CALLBACK_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(accessToken
              ? { Authorization: `Bearer ${accessToken}` }
              : {}),
          },
          body: JSON.stringify({ code, state }),
          signal: controller.signal,
        });
        const payload = (await res.json().catch(() => null)) as
          | { ok: boolean; error?: string }
          | null;
        if (!res.ok || !payload?.ok) {
          throw new Error(
            payload?.error || `Falha (${res.status}) ao concluir a conexão.`,
          );
        }
        toast.success("Mercado Livre conectado com sucesso!");
        void queryClient.invalidateQueries({ queryKey: MERCADOLIVRE_INTEGRATION_QUERY_KEY });
        // Pequeno delay para o usuário ver o toast antes do redirect.
        setTimeout(() => {
          navigate({ to: REDIRECT_TO, replace: true });
        }, 800);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Erro desconhecido.";
        setStatus("error");
        setErrorMsg(message);
        toast.error("Não foi possível conectar sua conta do Mercado Livre.", {
          description: message,
        });
      }
    })();

    return () => controller.abort();
  }, [attempt, navigate, queryClient]);

  return (
    <div className="min-h-screen grid place-items-center bg-background px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        {status === "loading" ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-4 text-lg font-semibold text-foreground">
              Conectando sua conta do Mercado Livre ao NexOS...
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Isso leva apenas alguns segundos. Não feche esta janela.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-foreground">
              Não conseguimos concluir a conexão
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {errorMsg ?? "Ocorreu um erro inesperado."}
            </p>
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button onClick={() => setAttempt((a) => a + 1)}>
                Tentar novamente
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate({ to: REDIRECT_TO, replace: true })}
              >
                Voltar às integrações
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
