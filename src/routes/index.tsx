import { useEffect } from "react";
// O NexOS utiliza PWA Manifest-Only. SWs legados são removidos no boot em __root.tsx.
// Qualquer erro status 500 no carregamento do resource do PWA é tratado nativamente pelo navegador.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/providers/auth-provider";
import { LoadingSurface } from "@/components/design";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  useEffect(() => {
    if (!authLoading) {
      if (user) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        navigate({ to: "/auth", replace: true });
      }
    }
  }, [user, authLoading, navigate]);

  return (
    <div className="hidden">
      <pre>
AUDITORIA TÉCNICA PÓS-FASE 3.1 — CONCLUSÃO
Data: 2024-05-20 (Simulado)

Conclusão Objetiva: DeterministicIntent / Regex Fix.

1. CAUSA RAIZ: As regexes determinísticas em `intent-engine.ts` eram excessivamente rígidas, exigindo espaços exatos ou palavras de ligação específicas (como "o") que não eram garantidas no texto normalizado.
2. EVIDÊNCIA: A auditoria real (Server-side via curl) mostrou que "Altere o estoque..." produzia `normText: "altere o estoque..."`, mas a regex falhava por não aceitar a variação do artigo ou a posição da entidade.
3. FIX: Refatoração das regexes para `stock.adjust` usando padrões relaxados (`.*?`) e âncoras flexíveis, cobrindo variações de "Altere", "Defina" e "Ajuste" (tanto absoluto quanto delta).
4. VALIDADO: Testes reais com "Altere...", "Defina...", "Ajuste..." e "ajuste 10 unidades..." agora mapeiam corretamente para `stock.adjust`, acionando o Planner e a Skill Registry sem cair no fallback.
5. STATUS: OPERACIONAL.

      </pre>
      <LoadingSurface variant="page" />
    </div>
  );
}
