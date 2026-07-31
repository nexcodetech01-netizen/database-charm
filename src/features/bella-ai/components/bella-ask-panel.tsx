import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Send } from "lucide-react";
import { ASK_EXAMPLES, QUICK_ACTION_PROMPTS } from "../workspace/data";

export function BellaAskPanel() {
  const [prompt, setPrompt] = useState("");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Pergunte para Bella IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Ações rápidas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTION_PROMPTS.map(({ id, label, prompt: p, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPrompt(p)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex.: quais produtos estão parados este mês?"
              className="min-h-[96px] resize-none"
            />
            <Button className="w-full gap-2" disabled>
              <Send className="h-4 w-4" /> Enviar
            </Button>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Exemplos
            </div>
            <ul className="space-y-1.5">
              {ASK_EXAMPLES.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => setPrompt(q)}
                    className="w-full rounded-md border border-border/70 bg-background px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
      {/* Últimas conversas → aba Histórico. Integrações futuras → Configurações → Bella IA. */}
    </div>
  );
}
