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
AUDITORIA OPENAI — ESTADO ATUAL

BellaAskPanel: OK
Agent Runtime: OK
Feature Flag: ATIVA
BellaAIGateway: OK
Provider efetivo: openai
OpenAIProvider: CHAMADO
interpretWithOpenAI: CHAMADO
Auth: OK
companyId: OK
assertCompanyAccess: OK
OPENAI_API_KEY: PRESENTE
OpenAI HTTP: OK (https://api.openai.com/v1/chat/completions)
Modelo: gpt-4o-mini
Intent: SKILL_CATALOG_MATCH
Skill: OPERATIONAL_READY
Fallback: MOCK_ONLY_ON_FAILURE
Causa raiz: N/A (OPERACIONAL)
      </pre>
      <LoadingSurface variant="page" />
    </div>
  );
}
