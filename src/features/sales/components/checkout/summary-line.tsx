import { memo } from "react";
import { cn } from "@/lib/utils";

interface SummaryLineProps {
  label: string;
  value: string;
  strong?: boolean;
  className?: string;
}

export const SummaryLine = memo(function SummaryLine({
  label,
  value,
  strong,
  className,
}: SummaryLineProps) {
  return (
    <div
      className={cn(
        "flex justify-between items-center",
        strong ? "border-t pt-1 font-semibold text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      <span>{label}</span>
      <span className={cn("tabular-nums", strong && "text-foreground text-base")}>{value}</span>
    </div>
  );
});
