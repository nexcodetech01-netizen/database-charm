/**
 * ProcessStudioHomeCard — card resumido para a Home da Bella.
 * Mostra contagens (ativos, rascunhos), últimos processos e falhas
 * recentes. Sem regra de negócio — apenas leitura do Studio.
 */
import { Link } from "@tanstack/react-router";
import { Workflow, ArrowRight, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useProcessStudioFlows,
  useProcessStudioStats,
} from "../hooks/use-process-studio";

export function ProcessStudioHomeCard({ companyId }: { companyId: string }) {
  const flows = useProcessStudioFlows(companyId);
  const stats = useProcessStudioStats(companyId);
  const recent = flows.slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="size-4 text-primary" />
            <CardTitle className="text-base">Processos</CardTitle>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/bella-processos">
              Abrir Studio <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Ativos" value={stats.active} tone="text-emerald-600 dark:text-emerald-400" />
          <Stat label="Rascunhos" value={stats.drafts} tone="text-muted-foreground" />
          <Stat label="Total" value={stats.total} tone="text-primary" />
        </div>
        {recent.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum processo criado. Abra o Studio para começar por um template.
          </p>
        ) : (
          <ul className="space-y-1">
            {recent.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between rounded border p-2 text-xs"
              >
                <span className="font-medium truncate">{f.name}</span>
                <Badge variant="outline" className="text-[10px]">
                  {f.status} · v{f.version}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {stats.recentFailures.length > 0 && (
          <div className="rounded border border-danger/30 bg-danger/5 p-2 text-xs text-danger flex items-center gap-2">
            <AlertTriangle className="size-3.5" />
            {stats.recentFailures.length} falha(s) recente(s)
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border p-2 text-center">
      <p className={`text-lg font-semibold ${tone}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
