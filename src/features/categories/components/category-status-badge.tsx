import { Badge } from "@/components/ui/badge";
import type { CategoryStatus } from "../types";

export function CategoryStatusBadge({ status }: { status: string }) {
  const s = status as CategoryStatus;
  if (s === "archived") {
    return (
      <Badge variant="secondary" className="font-medium">
        Arquivada
      </Badge>
    );
  }
  return (
    <Badge className="bg-success/10 text-success hover:bg-success/15 font-medium">
      Ativa
    </Badge>
  );
}
