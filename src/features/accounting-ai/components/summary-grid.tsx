import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** SummaryGrid — grade responsiva reutilizável para cards da Bella. */
export interface SummaryGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
  className?: string;
}

const COLS: Record<2 | 3 | 4, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export function SummaryGrid({ children, columns = 4, className }: SummaryGridProps) {
  return <div className={cn("grid grid-cols-1 gap-3", COLS[columns], className)}>{children}</div>;
}
