import { cn } from "@/lib/utils";
import { DOCUMENT_CATEGORIES } from "../data";
import type { DocumentCategory } from "../types";

export interface DocumentFiltersProps {
  value: DocumentCategory;
  onChange: (next: DocumentCategory) => void;
  counts?: Partial<Record<DocumentCategory, number>>;
}

export function DocumentFilters({ value, onChange, counts }: DocumentFiltersProps) {
  return (
    <div
      role="tablist"
      aria-label="Filtrar documentos por categoria"
      className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      {DOCUMENT_CATEGORIES.map((cat) => {
        const active = value === cat.id;
        const count = counts?.[cat.id];
        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(cat.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {cat.label}
            {typeof count === "number" ? (
              <span
                className={cn(
                  "rounded px-1 text-[10px] tabular-nums",
                  active
                    ? "bg-muted text-foreground"
                    : "bg-background text-muted-foreground",
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
