import { FlaskConical } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DATA_SCOPES,
  DATA_SCOPE_LABEL,
  setDataScope,
  useDataScope,
  type DataScope,
} from "../lib/test-data-scope";

/**
 * Filtro global Produção / Homologação / Todos.
 * Padrão: Produção — vendas de teste nunca contaminam indicadores.
 */
export function DataScopeFilter({ className }: { className?: string }) {
  const scope = useDataScope();
  return (
    <Select value={scope} onValueChange={(v) => setDataScope(v as DataScope)}>
      <SelectTrigger className={className ?? "h-9 w-[180px]"}>
        <FlaskConical className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {DATA_SCOPES.map((s) => (
          <SelectItem key={s} value={s}>
            {DATA_SCOPE_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
