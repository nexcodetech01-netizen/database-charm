import { StatusBadge } from "@/components/design";
import type { StatusToken } from "@/design";

const MAP: Record<string, { label: string; status: StatusToken }> = {
  active: { label: "Ativo", status: "success" },
  inactive: { label: "Inativo", status: "neutral" },
  draft: { label: "Rascunho", status: "draft" },
};

export function ProductStatusBadge({ status }: { status: string }) {
  const cfg = MAP[status] ?? { label: status, status: "neutral" as StatusToken };
  return (
    <StatusBadge status={cfg.status} withDot>
      {cfg.label}
    </StatusBadge>
  );
}
