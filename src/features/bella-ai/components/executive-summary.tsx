import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface ExecutiveSummaryProps {
  summary?: string;
}

const DEFAULT_SUMMARY =
  "Hoje identifiquei uma queda nas vendas da categoria Bolsas, um aumento nas despesas fixas e produtos com estoque baixo. Minha recomendação é revisar as compras da semana e iniciar a cobrança dos clientes inadimplentes ainda hoje para proteger o caixa.";

export function ExecutiveSummary({ summary = DEFAULT_SUMMARY }: ExecutiveSummaryProps) {
  return (
    <Card className="border-border/70 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Leitura da Bella</span>
            <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              placeholder
            </span>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
        </div>
      </CardContent>
    </Card>
  );
}
