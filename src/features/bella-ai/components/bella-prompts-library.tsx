import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import { Sparkles } from "lucide-react";
import {
  PROMPT_CATALOG,
  PROMPT_CATEGORY_LABELS,
  PROMPT_CATEGORY_ICON,
  type PromptCategory,
} from "../workspace/data";

const CATEGORIES: PromptCategory[] = ["favorites", "recent", "system", "custom"];

export function BellaPromptsLibrary() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {CATEGORIES.map((cat) => {
        const Icon = PROMPT_CATEGORY_ICON[cat];
        const items = PROMPT_CATALOG.filter((p) => p.category === cat);
        return (
          <Card key={cat} className="border-border/70">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Icon className="h-4 w-4 text-primary" />
                {PROMPT_CATEGORY_LABELS[cat]}
                <span className="ml-auto rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {items.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="Sem prompts nesta categoria"
                  description="A biblioteca de prompts será preenchida quando Bella IA estiver ativa."
                  className="border-0 bg-transparent px-0 py-6"
                />
              ) : (
                <ul className="space-y-2">
                  {items.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-md border border-border/70 bg-background px-3 py-2 text-sm"
                    >
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground">{p.description}</div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
