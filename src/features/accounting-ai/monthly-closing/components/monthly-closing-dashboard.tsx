import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMonthlyClosingAudit } from "../hooks/use-monthly-closing";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { selectDomainChecklist } from "../selectors";

export function MonthlyClosingDashboard() {
  const month = format(new Date(), "yyyy-MM");
  const { data: audit, isLoading, error } = useMonthlyClosingAudit(month);

  if (isLoading) return <div className="p-8 text-center">Carregando auditoria financeira...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Erro ao carregar auditoria.</div>;
  if (!audit) return null;

  const finChecklist = selectDomainChecklist(audit, "finance");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Fechamento Mensal — {month}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saúde Financeira</CardTitle>
            {audit.healthScore.score >= 70 ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{audit.healthScore.score}/100</div>
            <p className="text-xs text-muted-foreground">{audit.healthScore.level}</p>
            <Progress 
              value={audit.healthScore.score} 
              className={cn("mt-2", audit.healthScore.score < 40 ? "bg-red-100" : "")} 
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="bg-primary/10 p-1 rounded-full">✨</span>
            Resumo Financeiro da Bella
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground italic">
            "{audit.summary.monthSummary}"
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border bg-destructive/5 p-3">
              <h4 className="font-semibold text-xs mb-1 uppercase text-destructive">Maior Risco</h4>
              <p className="text-sm text-destructive">{audit.summary.biggestRisk}</p>
            </div>
            <div className="rounded-lg border bg-green-500/5 p-3">
              <h4 className="font-semibold text-xs mb-1 uppercase text-green-600">Maior Oportunidade</h4>
              <p className="text-sm text-green-600">{audit.summary.biggestOpportunity}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Checklist de Auditoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {finChecklist.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-accent/50 transition-colors">
                {item.status === "success" && <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />}
                {item.status === "warning" && <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />}
                {item.status === "error" && <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />}
                <div>
                  <h5 className="text-sm font-medium">{item.title}</h5>
                  <p className="text-xs text-muted-foreground">{item.message}</p>
                </div>
              </div>
            ))}
            {finChecklist.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma pendência financeira encontrada.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Timeline de Eventos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {audit.timeline.filter(e => e.domain === "finance").map((event, idx) => (
              <div key={idx} className="flex gap-3 relative pb-4 last:pb-0">
                <div className="mt-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.date), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                  <p className="text-sm">{event.event}</p>
                </div>
                {idx < audit.timeline.length - 1 && (
                  <div className="absolute left-[7px] top-6 bottom-0 w-[2px] bg-border" />
                )}
              </div>
            ))}
            {audit.timeline.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem eventos financeiros registrados.</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Alert className={cn(audit.healthScore.score >= 70 ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200")}>
        <AlertCircle className={cn("h-4 w-4", audit.healthScore.score >= 70 ? "text-green-600" : "text-yellow-600")} />
        <AlertTitle>Recomendação Final</AlertTitle>
        <AlertDescription>
          {audit.summary.finalRecommendation}
        </AlertDescription>
      </Alert>
    </div>
  );
}

