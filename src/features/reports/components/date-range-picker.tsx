import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DateRange, DateRangePreset } from "../types";
import { PRESET_LABELS, rangeFromPreset } from "../utils/date-range";

const DEFAULT_PRESETS: DateRangePreset[] = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "this_month",
  "this_year",
  "custom",
];

interface Props {
  value: DateRange;
  onChange: (r: DateRange) => void;
  presets?: DateRangePreset[];
}

export function DateRangePicker({ value, onChange, presets = DEFAULT_PRESETS }: Props) {
  const activePreset: DateRangePreset = presets.includes(value.preset) ? value.preset : "custom";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-card p-0.5">
        {presets.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant={activePreset === p ? "secondary" : "ghost"}
            onClick={() =>
              onChange(
                p === "custom"
                  ? { ...rangeFromPreset("custom", { from: value.from, to: value.to }) }
                  : rangeFromPreset(p),
              )
            }
            className={cn("h-7 px-3 text-xs")}
          >
            {PRESET_LABELS[p]}
          </Button>
        ))}
      </div>
      {value.preset === "custom" && (
        <div className="flex items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor="date-from" className="sr-only">De</Label>
            <Input
              id="date-from"
              type="date"
              value={value.from}
              max={value.to}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="h-8 w-[140px] text-xs"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="date-to" className="sr-only">Até</Label>
            <Input
              id="date-to"
              type="date"
              value={value.to}
              min={value.from}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="h-8 w-[140px] text-xs"
            />
          </div>
        </div>
      )}
    </div>
  );
}
