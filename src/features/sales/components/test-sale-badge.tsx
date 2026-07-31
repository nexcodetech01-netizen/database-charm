import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Marcador visual de venda de teste (NF-e emitida em HOMOLOGAÇÃO).
 * Nunca deve aparecer em operação real — a origem é `sales.is_test`.
 */
export function TestSaleBadge({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      title="NF-e emitida em HOMOLOGAÇÃO — documento sem validade fiscal."
      className={cn(
        "gap-1 border-warning/40 bg-warning/10 font-semibold text-warning",
        className,
      )}
    >
      <FlaskConical className="h-3 w-3" />
      {compact ? "TESTE" : "VENDA DE TESTE"}
    </Badge>
  );
}
