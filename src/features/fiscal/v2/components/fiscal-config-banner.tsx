import { Link } from "@tanstack/react-router";
import { AlertTriangle, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFiscalCertificates, useFiscalProviderConfig } from "../hooks/use-fiscal";

/**
 * Banner de aviso exibido quando o módulo Fiscal ainda não está
 * completamente configurado (provedor real e/ou certificado A1 ativo).
 * Reutiliza os hooks já cacheados por React Query — não faz fetches
 * adicionais quando montado em telas que já consomem essas queries.
 */
export function FiscalConfigBanner() {
  const provider = useFiscalProviderConfig();
  const certs = useFiscalCertificates();

  // Enquanto carrega, não exibimos nada (evita flash).
  if (provider.isLoading || certs.isLoading) return null;

  const providerMissing =
    !provider.data || provider.data.providerId === "mock";
  const apiKeyMissing =
    !!provider.data && provider.data.providerId !== "mock" && !provider.data.hasApiKey;
  const certMissing =
    !certs.data || certs.data.every((c) => !c.isActive);

  if (!providerMissing && !apiKeyMissing && !certMissing) return null;

  const missing: string[] = [];
  if (providerMissing) missing.push("provedor fiscal");
  if (apiKeyMissing) missing.push("API key do provedor");
  if (certMissing) missing.push("certificado A1");

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-warning"
          aria-hidden="true"
        />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">
            Configuração fiscal pendente
          </p>
          <p className="text-xs text-muted-foreground">
            Antes de emitir NF-e válidas na SEFAZ, configure{" "}
            {missing.join(" e ")}.
          </p>
        </div>
      </div>
      <Button asChild size="sm">
        <Link to="/fiscal/configuracao">
          <Settings2 className="mr-1.5 h-4 w-4" /> Configurar agora
        </Link>
      </Button>
    </div>
  );
}
