import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AvailabilityKind = "available" | "out" | "presale";

interface AvailabilityBadgeProps {
  kind: AvailabilityKind;
  className?: string;
  size?: "sm" | "md";
}

const LABELS: Record<AvailabilityKind, string> = {
  available: "Disponível",
  out: "Esgotado",
  presale: "Pré-venda",
};

export function AvailabilityBadge({
  kind,
  className,
  size = "md",
}: AvailabilityBadgeProps) {
  const sizeCls = size === "sm" ? "text-[10px] px-1.5 py-0" : "";

  if (kind === "out") {
    return (
      <Badge variant="secondary" className={cn(sizeCls, className)}>
        {LABELS.out}
      </Badge>
    );
  }
  if (kind === "presale") {
    return (
      <Badge
        className={cn(
          "border-amber-500/40 bg-amber-500/15 text-amber-900 hover:bg-amber-500/20 dark:text-amber-200",
          sizeCls,
          className,
        )}
      >
        {LABELS.presale}
      </Badge>
    );
  }
  return (
    <Badge
      className={cn(
        "border-emerald-500/40 bg-emerald-500/15 text-emerald-900 hover:bg-emerald-500/20 dark:text-emerald-200",
        sizeCls,
        className,
      )}
    >
      {LABELS.available}
    </Badge>
  );
}

export function resolveAvailability(
  stock: number,
  opts: { presale?: boolean } = {},
): AvailabilityKind {
  if (opts.presale) return "presale";
  return stock > 0 ? "available" : "out";
}
