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

import { companyDayStartUtc, companyEndOfDay } from "@/lib/time/company-day";

/**
 * Converte um DateRange (datas "de calendário", ex.: "2026-08-13") em
 * timestamps UTC prontos para consultas no Supabase.
 *
 * FIX (auditoria de 2026-08-13): antes, o sufixo "Z" tratava a data como
 * meia-noite em UTC, não no fuso do Brasil (UTC-3) — meia-noite em UTC é
 * 21h da noite ANTERIOR aqui. Na prática, vendas feitas à noite (depois
 * das ~21h) ficavam de fora do relatório de "hoje" (só apareciam no dia
 * seguinte), e dados da noite do dia anterior vazavam para "hoje". Usa o
 * utilitário compartilhado `company-day` (já é o padrão do projeto para
 * qualquer leitura de "hoje"/limite de dia) em vez de montar a string à
 * mão.
 */
export function rangeToTimestamp(range: DateRange) {
  return {
    fromTs: new Date(companyDayStartUtc(range.from)).toISOString(),
    toTs: companyEndOfDay(range.to).toISOString(),
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

