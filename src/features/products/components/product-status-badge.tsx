import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { label: string; variant: "success" | "secondary" | "outline" }> = {
  active: { label: "Ativo", variant: "success" },
  inactive: { label: "Inativo", variant: "secondary" },
  draft: { label: "Rascunho", variant: "outline" },
};

export function ProductStatusBadge({ status }: { status: string }) {
  const cfg = MAP[status] ?? { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
