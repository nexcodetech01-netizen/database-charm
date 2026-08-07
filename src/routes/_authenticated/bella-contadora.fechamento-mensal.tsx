import { createFileRoute } from "@tanstack/react-router";
import { MonthlyClosingDashboard } from "@/features/accounting-ai/monthly-closing";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bella-contadora/fechamento-mensal")({
  component: MonthlyClosingPage,
});

function MonthlyClosingPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fechamento Mensal Inteligente</h1>
          <p className="text-muted-foreground">
            Auditoria completa da empresa pela Bella antes do encerramento do mês.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Calendar className="mr-2 h-4 w-4" />
            Julho / 2026
          </Button>
          <Button>Iniciar Auditoria</Button>
        </div>
      </div>

      <MonthlyClosingDashboard />
      
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Checklist de Auditoria</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Selecione os domínios acima para detalhar as validações.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Timeline do Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Histórico visual de eventos financeiros, fiscais e operacionais.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
