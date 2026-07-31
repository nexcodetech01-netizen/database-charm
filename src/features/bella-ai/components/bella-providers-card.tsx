import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { listProviders } from "../providers";
import { PROVIDER_LABELS } from "../types";

export function BellaProvidersCard() {
  const providers = listProviders();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Provedores de IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {providers.map((p) => (
          <div
            key={p.provider}
            className="flex items-center justify-between rounded-md border border-border/70 bg-card px-3 py-2"
          >
            <div>
              <div className="text-sm font-medium">{PROVIDER_LABELS[p.provider]}</div>
              <div className="text-xs text-muted-foreground">
                {p.availableModels.length} modelo(s) • padrão: {p.defaultModel}
              </div>
            </div>
            <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              não integrado
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
