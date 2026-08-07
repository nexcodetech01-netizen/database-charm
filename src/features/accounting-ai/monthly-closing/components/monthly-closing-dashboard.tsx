import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMonthlyClosingAudit } from "../hooks/use-monthly-closing";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function MonthlyClosingDashboard() {
  const { data: audit, isLoading } = useMonthlyClosingAudit(format(new Date(), "yyyy-MM"));

  if (isLoading || !audit) return <div>Carregando auditoria...</div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nota de Saúde</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{audit.healthScore.score}/100</div>
            <p className="text-xs text-muted-foreground">{audit.healthScore.level}</p>
            <Progress value={audit.healthScore.score} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo Executivo da Bella</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm italic">{audit.summary.monthSummary}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold text-sm mb-2">Maior Risco</h4>
              <p className="text-sm text-red-600">{audit.summary.biggestRisk}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Maior Oportunidade</h4>
              <p className="text-sm text-green-600">{audit.summary.biggestOpportunity}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
