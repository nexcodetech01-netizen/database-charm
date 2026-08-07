import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMonthlyClosingAudit } from "../hooks/use-monthly-closing";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  BarChart3,
  ShieldCheck,
  Package,
  ShoppingCart,
  DollarSign,
  Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";
import { selectDomainChecklist } from "../selectors";
import { MonthlyClosingAudit } from "../types";

export function MonthlyClosingDashboard() {
  const month = format(new Date(), "yyyy-MM");
  const { data: audit, isLoading, error } = useMonthlyClosingAudit(month);

  if (isLoading) return <div className="p-8 text-center">Carregando auditoria geral...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Erro ao carregar auditoria.</div>;
  if (!audit) return null;

  const domains = [
    { id: "finance", name: "Financeiro", icon: DollarSign, color: "text-blue-500", bg: "bg-blue-500/10" },
    { id: "fiscal", name: "Fiscal", icon: ShieldCheck, color: "text-purple-500", bg: "bg-purple-500/10" },
    { id: "inventory", name: "Estoque", icon: Package, color: "text-orange-500", bg: "bg-orange-500/10" },
    { id: "purchases", name: "Compras", icon: ShoppingCart, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { id: "sales", name: "Vendas", icon: BarChart3, color: "text-rose-500", bg: "bg-rose-500/10" },
    { id: "pos", name: "Caixa", icon: Wallet, color: "text-amber-500", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bella Certification</h2>
          <p className="text-muted-foreground">Relatório oficial de prontidão para fechamento gerencial.</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{format(new Date(), "MMMM yyyy", { locale: ptBR })}</p>
          <div className="flex items-center gap-2 mt-1 justify-end">
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-bold uppercase border-2",
              audit.summary.certificationStatus === "Empresa apta" ? "bg-green-50 text-green-700 border-green-200" :
              audit.summary.certificationStatus === "Empresa apta com ressalvas" ? "bg-yellow-50 text-yellow-700 border-yellow-200" :
              "bg-red-50 text-red-700 border-red-200"
            )}>
              {audit.summary.certificationStatus || "Auditoria em progresso"}
            </span>
          </div>
          {audit.summary.certifiedAt && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Certificado em: {format(new Date(audit.summary.certifiedAt), "dd/MM/yyyy HH:mm")}
            </p>
          )}
        </div>
      </div>

      {/* Global Score & Health */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="md:col-span-1 flex flex-col justify-center border-2 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase">Score Geral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-5xl font-black text-primary">{audit.healthScore.score}<span className="text-2xl text-muted-foreground/50">/100</span></div>
            <Progress 
              value={audit.healthScore.score} 
              className={cn("mt-4 h-3", 
                audit.healthScore.score >= 70 ? "bg-primary/20" : "bg-destructive/20"
              )} 
            />
            <p className="text-xs text-muted-foreground mt-4 leading-relaxed italic">
              {audit.healthScore.label}
            </p>
          </CardContent>
        </Card>

        {/* Executive Summary */}
        <Card className="md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Resumo Executivo da Bella
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base font-medium leading-relaxed">
              {audit.summary.monthSummary}
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-destructive/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-destructive font-bold text-xs uppercase">
                  <TrendingDown className="h-4 w-4" />
                  Maior Risco
                </div>
                <p className="text-sm font-medium text-destructive/90">{audit.summary.biggestRisk}</p>
              </div>
              <div className="rounded-xl border bg-green-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-green-600 font-bold text-xs uppercase">
                  <TrendingUp className="h-4 w-4" />
                  Maior Oportunidade
                </div>
                <p className="text-sm font-medium text-green-700/90">{audit.summary.biggestOpportunity}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Domain Scores Cockpit */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {domains.map(domain => {
          const checklist = audit.checklist.filter(i => i.domain === domain.id);
          const errors = checklist.filter(i => i.status === 'error').length;
          
          // Reutiliza score do domínio se possível ou estima pela checklist
          // Idealmente passamos os scores individuais no objeto audit, mas aqui consolidamos
          return (
            <Card key={domain.id} className="overflow-hidden group hover:border-primary/40 transition-all">
              <CardHeader className={cn("p-4 pb-2", domain.bg)}>
                <div className="flex items-center justify-between">
                  <domain.icon className={cn("h-5 w-5", domain.color)} />
                  {errors > 0 && <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">{errors} ❌</span>}
                </div>
                <CardTitle className="text-xs font-bold uppercase mt-2 tracking-tight">{domain.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="flex items-end justify-between">
                  <span className="text-xs text-muted-foreground">{checklist.length} itens</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Unified Pending Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Pendências e Auditoria
              <span className="text-xs font-normal text-muted-foreground ml-auto">{audit.checklist.length} itens totais</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            <div className="space-y-1">
              {audit.checklist.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-accent/50 transition-colors border border-transparent hover:border-border">
                  <div className="mt-1">
                    {item.status === "error" && <AlertCircle className="h-5 w-5 text-red-500" />}
                    {item.status === "warning" && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                    {item.status === "success" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h5 className="text-sm font-semibold">{item.title}</h5>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground/50">{item.domain}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.message}</p>
                  </div>
                  {item.status === "error" && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded">CRÍTICO</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Unified Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Timeline Unificada de Eventos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
            {audit.timeline.map((event, idx) => (
              <div key={idx} className="flex gap-4 relative pb-2">
                <div className="z-10 bg-background p-1 border rounded-full">
                  {event.type === "error" ? <AlertCircle className="h-3 w-3 text-red-500" /> :
                   event.type === "warning" ? <AlertTriangle className="h-3 w-3 text-yellow-500" /> :
                   <CheckCircle2 className="h-3 w-3 text-green-500" />}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">{event.domain}</span>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(event.date), "dd/MM HH:mm", { locale: ptBR })}</span>
                  </div>
                  <p className="text-sm font-medium leading-none">{event.event}</p>
                </div>
                {idx < audit.timeline.length - 1 && (
                  <div className="absolute left-[13px] top-6 bottom-0 w-[1px] bg-border" />
                )}
              </div>
            ))}
            {audit.timeline.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum evento registrado no período.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendation & Insights */}
      <Alert className={cn(
        "border-2",
        audit.healthScore.score >= 70 ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
      )}>
        <Activity className={cn("h-5 w-5", audit.healthScore.score >= 70 ? "text-green-600" : "text-yellow-600")} />
        <AlertTitle className="font-bold text-base">Bella Insights — Recomendação para Fechamento</AlertTitle>
        <AlertDescription className="text-sm mt-2 font-medium leading-relaxed">
          {audit.summary.finalRecommendation}
        </AlertDescription>
      </Alert>
    </div>
  );
}
