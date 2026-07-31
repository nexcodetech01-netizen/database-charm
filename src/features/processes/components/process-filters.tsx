import { cn } from "@/lib/utils";
import { PROCESS_FILTERS } from "../data";
import type { ProcessFilter } from "../types";

export interface ProcessFiltersProps {
  value: ProcessFilter;
  onChange: (next: ProcessFilter) => void;
  counts?: Partial<Record<ProcessFilter, number>>;
}

export function ProcessFilters({ value, onChange, counts }: ProcessFiltersProps) {
  return (
    <div
      role="tablist"
      aria-label="Filtrar processamentos por status"
      className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      {PROCESS_FILTERS.map((filter) => {
        const active = value === filter.id;
        const count = counts?.[filter.id];
        return (
          <button
            key={filter.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(filter.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {filter.label}
            {typeof count === "number" ? (
              <span
                className={cn(
                  "rounded px-1 text-[10px] tabular-nums",
                  active ? "bg-muted text-foreground" : "bg-background text-muted-foreground",
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
