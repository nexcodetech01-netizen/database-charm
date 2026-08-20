import { useState } from "react";
import { Check, X, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RADIUS_TOKENS, TEXT_TOKENS } from "@/design";
import type { AgentPlan } from "../agent/types";

export type ActionCardStatus = "preview" | "confirming" | "executing" | "success" | "error" | "cancelled";

interface ActionCardProps {
  title: string;
  icon?: React.ReactNode;
  summary?: string;
  details?: React.ReactNode;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  status?: ActionCardStatus;
  errorMessage?: string;
  className?: string;
}

export function ActionCard({
  title,
  icon,
  summary,
  details,
  onConfirm,
  onCancel,
  status: externalStatus,
  errorMessage,
  className,
}: ActionCardProps) {
  const [internalStatus, setInternalStatus] = useState<ActionCardStatus>(externalStatus || "confirming");
  const status = externalStatus || internalStatus;

  const handleConfirm = async () => {
    setInternalStatus("executing");
    try {
      await onConfirm();
      setInternalStatus("success");
    } catch (err) {
      setInternalStatus("error");
    }
  };

  const handleCancel = () => {
    setInternalStatus("cancelled");
    onCancel();
  };

  if (status === "success") {
    return (
      <Card className={cn("border-green-500/50 bg-green-50/50 dark:bg-green-900/10", className)}>
        <CardContent className="pt-6 text-center space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <p className={cn("font-medium text-green-700 dark:text-green-300", TEXT_TOKENS.sm)}>
            Operação concluída com sucesso!
          </p>
        </CardContent>
      </Card>
    );
  }

  if (status === "cancelled") {
    return (
      <Card className={cn("border-muted bg-muted/30", className)}>
        <CardContent className="pt-6 text-center">
          <p className={cn("text-muted-foreground", TEXT_TOKENS.sm)}>
            Operação cancelada. Nenhuma alteração foi realizada.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="bg-muted/30 pb-3">
        <CardTitle className={cn("flex items-center gap-2", TEXT_TOKENS.sm)}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {summary && <p className={cn("font-medium", TEXT_TOKENS.sm)}>{summary}</p>}
        {details && <div className={cn("text-muted-foreground", TEXT_TOKENS.xs)}>{details}</div>}
        
        {status === "error" && (
          <div className="flex items-center gap-2 p-2 rounded bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{errorMessage || "Ocorreu um erro ao executar a ação."}</p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex gap-2 pt-2 bg-muted/10">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleCancel}
          disabled={status === "executing"}
        >
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleConfirm}
          disabled={status === "executing"}
        >
          {status === "executing" ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1" />
          ) : (
            <Check className="h-4 w-4 mr-1" />
          )}
          Confirmar
        </Button>
      </CardFooter>
    </Card>
  );
}
