import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

/**
 * Right-side sticky panel used in operational screens (PDV/Sales, Purchases,
 * Financeiro). Holds summaries, totals, and primary actions while the main
 * area stays focused on the operation.
 */
export interface DetailPanelProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function DetailPanel({
  title,
  description,
  children,
  actions,
  className,
}: DetailPanelProps) {
  return (
    <Card
      className={cn(
        "sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden",
        className,
      )}
    >
      {title ? (
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      <CardContent className="flex-1 space-y-4 overflow-y-auto p-5">
        {children}
      </CardContent>
      {actions ? (
        <>
          <Separator />
          <div className="flex flex-col gap-2 bg-muted/30 px-5 py-4">{actions}</div>
        </>
      ) : null}
    </Card>
  );
}

/**
 * Aligned label/value row used inside DetailPanel summaries and detail
 * "Visão geral" cards. Values right-align; monetary values use tabular-nums.
 */
export function SummaryRow({
  label,
  value,
  emphasis,
  mono,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  emphasis?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 text-sm",
        emphasis && "text-base font-semibold text-foreground",
        !emphasis && "text-muted-foreground",
        className,
      )}
    >
      <span className="truncate">{label}</span>
      <span
        className={cn(
          "shrink-0 text-foreground",
          mono && "font-mono tabular-nums",
          emphasis && "text-lg",
        )}
      >
        {value}
      </span>
    </div>
  );
}
