import type { DateRange, DateRangePreset } from "../types";

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function rangeFromPreset(preset: DateRangePreset, custom?: { from: string; to: string }): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":
      return { preset, from: toISO(today), to: toISO(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { preset, from: toISO(y), to: toISO(y) };
    }
    case "this_week": {
      const day = today.getDay();
      const start = new Date(today);
      start.setDate(today.getDate() - day);
      return { preset, from: toISO(start), to: toISO(today) };
    }
    case "this_month": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { preset, from: toISO(start), to: toISO(today) };
    }
    case "last_7_days": {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      return { preset, from: toISO(start), to: toISO(today) };
    }
    case "last_30_days": {
      const start = new Date(today);
      start.setDate(today.getDate() - 29);
      return { preset, from: toISO(start), to: toISO(today) };
    }
    case "last_90_days": {
      const start = new Date(today);
      start.setDate(today.getDate() - 89);
      return { preset, from: toISO(start), to: toISO(today) };
    }
    case "this_year": {
      const start = new Date(today.getFullYear(), 0, 1);
      return { preset, from: toISO(start), to: toISO(today) };
    }
    case "custom":
      return {
        preset,
        from: custom?.from ?? toISO(today),
        to: custom?.to ?? toISO(today),
      };
  }
}

export function daysBetween(fromISO: string, toISO: string): string[] {
  const out: string[] = [];
  const from = new Date(`${fromISO}T00:00:00`);
  const to = new Date(`${toISO}T00:00:00`);
  const cur = new Date(from);
  while (cur <= to) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
    if (out.length > 400) break;
  }
  return out;
}

export function labelDay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function rangeToTimestamp(range: DateRange) {
  return {
    fromTs: `${range.from}T00:00:00.000Z`,
    toTs: `${range.to}T23:59:59.999Z`,
  };
}

export const PRESET_LABELS: Record<DateRangePreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  this_week: "Esta semana",
  this_month: "Este mês",
  last_7_days: "7 dias",
  last_30_days: "30 dias",
  last_90_days: "90 dias",
  this_year: "Ano",
  custom: "Personalizado",
};

