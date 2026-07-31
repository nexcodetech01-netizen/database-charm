import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

/**
 * Standard monetary value renderer. Uses tabular-nums so digits align
 * vertically in tables and summaries. `intent` gives a semantic tint for
 * positive (credits/receitas) or negative (debits/despesas) values.
 */
export interface MoneyValueProps {
  value: number | null | undefined;
  intent?: "neutral" | "positive" | "negative";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function MoneyValue({
  value,
  intent = "neutral",
  size = "md",
  className,
}: MoneyValueProps) {
  const amount = value ?? 0;
  const sizeClass =
    size === "sm"
      ? "text-xs"
      : size === "lg"
        ? "text-lg"
        : size === "xl"
          ? "text-2xl"
          : "text-sm";
  const tone =
    intent === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : intent === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";
  return (
    <span className={cn("font-mono tabular-nums", sizeClass, tone, className)}>
      {formatCurrency(amount)}
    </span>
  );
}
