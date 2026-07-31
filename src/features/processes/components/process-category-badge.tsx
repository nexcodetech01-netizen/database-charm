import { PROCESS_CATEGORY_LABELS } from "../data";
import { PROCESS_CATEGORY_ICON } from "../icons";
import type { ProcessCategory } from "../types";

export function ProcessCategoryBadge({ category }: { category: ProcessCategory }) {
  const Icon = PROCESS_CATEGORY_ICON[category];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      <Icon className="h-3 w-3" aria-hidden="true" />
      {PROCESS_CATEGORY_LABELS[category]}
    </span>
  );
}
