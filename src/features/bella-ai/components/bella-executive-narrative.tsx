import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * Leitura da Bella — resumo executivo compacto.
 *
 * Exibe apenas o essencial na Home; a análise completa abre em Dialog
 * para preservar toda a narrativa sem poluir a Visão Geral.
 */
const SHORT_SUMMARY =
  "Queda em Bolsas, alta nas despesas fixas e estoques baixos. Priorize cobrança de inadimplentes e revisão de compras hoje.";

const FULL_SUMMARY =
  "Hoje identifiquei uma queda nas vendas da categoria Bolsas, um aumento nas despesas fixas e produtos com estoque baixo. Minha recomendação é revisar as compras da semana e iniciar a cobrança dos clientes inadimplentes ainda hoje para proteger o caixa.";

export function BellaExecutiveNarrative() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card className="border-border/70 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3.5 sm:p-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Leitura da Bella</span>
              <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                resumo
              </span>
            </div>
            <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {SHORT_SUMMARY}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1"
            onClick={() => setOpen(true)}
          >
            <span className="hidden sm:inline">Ver análise completa</span>
            <span className="sm:hidden">Ver mais</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Leitura da Bella
            </DialogTitle>
            <DialogDescription>Análise executiva do dia com prioridades e recomendações.</DialogDescription>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-foreground">{FULL_SUMMARY}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
