import { Badge } from "@/components/ui/badge";
import type { PricingStatus } from "../types";

const TONE: Record<PricingStatus, { className: string; dot: string }> = {
  premium: {
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  healthy: {
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  attention: {
    className: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  below: {
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

export function PricingStatusBadge({
  status,
  label,
}: {
  status: PricingStatus;
  label?: string;
}) {
  const tone = TONE[status];
  return (
    <Badge variant="outline" className={tone.className}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
      {label ?? status}
    </Badge>
  );
}
