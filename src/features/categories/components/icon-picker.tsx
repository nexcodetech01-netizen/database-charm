import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, type CategoryIcon } from "../types";

type LucideIcon = React.ComponentType<{ className?: string }>;

export function getCategoryIcon(name: string): LucideIcon {
  const record = Icons as unknown as Record<string, LucideIcon | undefined>;
  return record[name] ?? Icons.Tag;
}

export function CategoryIconGlyph({
  name,
  color,
  className,
}: {
  name: string;
  color?: string;
  className?: string;
}) {
  const Icon = getCategoryIcon(name);
  return (
    <span
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md border border-border",
        className,
      )}
      style={color ? { backgroundColor: `${color}14`, color } : undefined}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function IconPicker({
  value,
  onChange,
  color,
}: {
  value: string;
  onChange: (v: CategoryIcon) => void;
  color?: string;
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {CATEGORY_ICONS.map((name) => {
        const Icon = getCategoryIcon(name);
        const active = value === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            aria-label={name}
            className={cn(
              "grid h-9 w-9 place-items-center rounded-md border border-border transition-colors",
              active
                ? "border-primary bg-primary/5 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            style={active && color ? { borderColor: color, color } : undefined}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
