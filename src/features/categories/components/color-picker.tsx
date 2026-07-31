import { cn } from "@/lib/utils";
import { CATEGORY_COLORS } from "../types";

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORY_COLORS.map((color) => {
        const active = value.toLowerCase() === color.toLowerCase();
        return (
          <button
            key={color}
            type="button"
            aria-label={color}
            onClick={() => onChange(color)}
            className={cn(
              "h-7 w-7 rounded-full border transition-transform",
              active
                ? "border-foreground scale-110 ring-2 ring-offset-2 ring-offset-background"
                : "border-border hover:scale-105",
            )}
            style={{
              backgroundColor: color,
              ...(active ? ({ "--tw-ring-color": color } as React.CSSProperties) : {}),
            }}
          />
        );
      })}
    </div>
  );
}
