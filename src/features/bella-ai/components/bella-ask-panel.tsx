import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section } from "@/components/design";
import { INTERACTION_TOKENS, RADIUS_TOKENS, TEXT_TOKENS } from "@/design";
import { ASK_EXAMPLES, QUICK_ACTION_PROMPTS } from "../workspace/data";

export function BellaAskPanel() {
  const [prompt, setPrompt] = useState("");

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" /> Pergunte para Bella IA
        </span>
      }
      density="comfortable"
    >
      <div data-testid="bella-ask-panel" className="space-y-5">
        <div className="space-y-2">
          <p
            className={cn(
              "font-medium uppercase tracking-wide text-muted-foreground",
              TEXT_TOKENS.xs,
            )}
          >
            Ações rápidas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTION_PROMPTS.map(({ id, label, prompt: p, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPrompt(p)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 font-medium text-muted-foreground",
                  TEXT_TOKENS.xs,
                  INTERACTION_TOKENS.hover,
                  INTERACTION_TOKENS.focus,
                  "hover:border-primary/40 hover:bg-accent/40 hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
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
            className="min-h-[104px] resize-none"
          />
          <Button className="w-full gap-2" disabled>
            <Send className="h-4 w-4" /> Enviar
          </Button>
        </div>

        <div className="space-y-2">
          <p
            className={cn(
              "font-medium uppercase tracking-wide text-muted-foreground",
              TEXT_TOKENS.xs,
            )}
          >
            Exemplos
          </p>
          <ul className="space-y-1.5">
            {ASK_EXAMPLES.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => setPrompt(q)}
                  className={cn(
                    "w-full border border-border bg-background px-3 py-2 text-left text-muted-foreground",
                    RADIUS_TOKENS.lg,
                    TEXT_TOKENS.xs,
                    INTERACTION_TOKENS.hover,
                    INTERACTION_TOKENS.focus,
                    "hover:border-primary/30 hover:bg-accent/40 hover:text-foreground",
                  )}
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
