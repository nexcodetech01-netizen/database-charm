import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";

/**
 * Linha de erro para tabelas: quando a lista não carrega, avisa em vez de
 * mostrar "nenhum item" (que faria uma falha parecer dado vazio).
 */
export function TableErrorRow({
  colSpan,
  what,
  onRetry,
}: {
  colSpan: number;
  /** ex.: "as compras" */
  what: string;
  onRetry?: () => void;
}) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-16">
        <div
          role="alert"
          className="flex flex-col items-center gap-2 text-center text-muted-foreground"
        >
          <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden="true" />
          <p className="font-medium text-foreground">Não foi possível carregar {what}</p>
          <p className="text-sm">
            Os dados não sumiram — a lista só não carregou. Verifique a internet e tente de novo.
          </p>
          {onRetry ? (
            <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
              Tentar novamente
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Texto padrão para tabelas que aceitam `error` (EnterpriseDataTable). */
export function loadErrorText(what: string) {
  return `Não conseguimos carregar ${what}. Os dados não sumiram — verifique a internet e tente de novo.`;
}
