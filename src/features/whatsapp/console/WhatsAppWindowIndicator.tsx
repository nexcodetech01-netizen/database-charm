import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

/** 
 * Indicador de Janela de 24 horas do WhatsApp.
 * Requisito 4: Indicador visual discreto sobre o status da janela.
 */
export function WhatsAppWindowIndicator({
  lastAt,
  className,
}: {
  lastAt: string | null;
  className?: string;
}) {
  if (!lastAt) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20", 
              className
            )}>
              <AlertCircle className="h-3 w-3" />
              <span>Janela Fechada</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Nenhuma mensagem recebida do cliente ainda. Envie um Template para iniciar.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const lastDate = new Date(lastAt);
  const diffMs = Date.now() - lastDate.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const isOpen = diffHours <= 24;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors",
              isOpen 
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
              className
            )}
          >
            {isOpen ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            <span>{isOpen ? "🟢 Janela Ativa" : "Janela Expirada"}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-[250px]">
          <div className="space-y-1">
            <p className="font-semibold">
              {isOpen ? "Atendimento Liberado" : "Janela de 24h Expirada"}
            </p>
            <p className="text-xs text-muted-foreground">
              Última mensagem do cliente: {formatDistanceToNow(lastDate, { addSuffix: true, locale: ptBR })}
            </p>
            {!isOpen && (
              <p className="text-xs text-amber-200 mt-2">
                A Meta exige o envio de um **Template Aprovado** para reabrir a conversa.
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
