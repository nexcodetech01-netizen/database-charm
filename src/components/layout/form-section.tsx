import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard form section wrapper. Provides a two-column layout on desktop
 * (title/description on the left, fields on the right) and stacks on mobile.
 * Groups related fields visually and creates a consistent rhythm across
 * every long form in NexOS (Products, CRM, Finance, etc.).
 */
export interface FormSectionProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}

export function FormSection({
  title,
  description,
  children,
  aside,
  className,
}: FormSectionProps) {
  return (
    <section
      className={cn(
        "grid gap-6 border-b border-border py-6 last:border-b-0 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
        {aside}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/**
 * Grid helper for placing fields side-by-side inside a FormSection.
 * Defaults to a two-column grid at `sm:` and above; use `cols={1}` for
 * full-width fields (textarea, address search).
 */
export function FormGrid({
  children,
  cols = 2,
  className,
}: {
  children: ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
}) {
  const gridCols =
    cols === 1
      ? "grid-cols-1"
      : cols === 3
        ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2";
  return <div className={cn("grid gap-4", gridCols, className)}>{children}</div>;
}
