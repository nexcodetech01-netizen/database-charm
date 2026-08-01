import { describe, expect, it } from "vitest";
import {
  addDaysStr,
  companyCompareDay,
  companyCompareMonth,
  companyDateRange,
  companyDayKey,
  companyDayStartUtc,
  companyEndOfDay,
  companyEndOfMonth,
  companyIsSameDay,
  companyMonthKey,
  companyMonthRange,
  companyNow,
  companyStartOfDay,
  companyStartOfMonth,
  companyToday,
  companyTodayISO,
  companyYearKey,
  DEFAULT_COMPANY_TZ,
  tzOffsetMs,
} from "@/lib/time";

const SP = "America/Sao_Paulo";
const UTC = "UTC";

describe("virada do dia", () => {
  it("02:00Z ainda é o dia anterior em São Paulo", () => {
    const instant = new Date("2026-03-10T02:00:00Z");
    expect(companyDayKey(instant, SP)).toBe("2026-03-09");
    expect(companyDayKey(instant, UTC)).toBe("2026-03-10");
  });

  it("03:00Z já é o novo dia em São Paulo", () => {
    const instant = new Date("2026-03-10T03:00:00Z");
    expect(companyDayKey(instant, SP)).toBe("2026-03-10");
  });

  it("virada de mês e ano respeita o fuso", () => {
    const instant = new Date("2027-01-01T01:30:00Z");
    expect(companyMonthKey(instant, SP)).toBe("2026-12");
    expect(companyYearKey(instant, SP)).toBe("2026");
    expect(companyMonthKey(instant, UTC)).toBe("2027-01");
  });
});

describe("offset e início/fim de dia", () => {
  it("São Paulo está 3h atrás do UTC (sem horário de verão)", () => {
    expect(tzOffsetMs(new Date("2026-07-15T12:00:00Z"), SP)).toBe(-3 * 3600_000);
    expect(tzOffsetMs(new Date("2026-07-15T12:00:00Z"), UTC)).toBe(0);
  });

  it("companyStartOfDay/EndOfDay cobrem exatamente 24h", () => {
    const start = companyStartOfDay("2026-07-15", SP);
    const end = companyEndOfDay("2026-07-15", SP);
    expect(start.toISOString()).toBe("2026-07-15T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-07-16T02:59:59.999Z");
    expect(end.getTime() - start.getTime()).toBe(86_400_000 - 1);
  });

  it("em UTC o dia começa à meia-noite Z", () => {
    expect(companyStartOfDay("2026-07-15", UTC).toISOString()).toBe(
      "2026-07-15T00:00:00.000Z",
    );
  });

  it("aceita instante além de string ISO", () => {
    const start = companyStartOfDay(new Date("2026-07-15T23:00:00Z"), SP);
    expect(companyDayKey(start, SP)).toBe("2026-07-15");
  });
});

describe("horário de verão (histórico brasileiro)", () => {
  it("2018-02-17 (DST ativo) usa offset -02:00", () => {
    expect(tzOffsetMs(new Date("2018-02-17T12:00:00Z"), SP)).toBe(-2 * 3600_000);
    expect(companyStartOfDay("2018-02-17", SP).toISOString()).toBe(
      "2018-02-17T02:00:00.000Z",
    );
  });

  it("fusos com DST no hemisfério norte também funcionam", () => {
    const NY = "America/New_York";
    expect(tzOffsetMs(new Date("2026-01-15T12:00:00Z"), NY)).toBe(-5 * 3600_000);
    expect(tzOffsetMs(new Date("2026-07-15T12:00:00Z"), NY)).toBe(-4 * 3600_000);
  });
});

describe("comparações", () => {
  const a = new Date("2026-03-10T02:00:00Z");
  const b = new Date("2026-03-10T04:00:00Z");

  it("mesmo dia em UTC, dias diferentes em São Paulo", () => {
    expect(companyIsSameDay(a, b, UTC)).toBe(true);
    expect(companyIsSameDay(a, b, SP)).toBe(false);
    expect(companyCompareDay(a, b, SP)).toBe(-1);
    expect(companyCompareDay(b, a, SP)).toBe(1);
    expect(companyCompareDay(a, a, SP)).toBe(0);
  });

  it("compara meses", () => {
    expect(
      companyCompareMonth("2026-01-15T12:00:00Z", "2026-02-01T12:00:00Z", SP),
    ).toBe(-1);
    expect(
      companyCompareMonth("2026-02-15T12:00:00Z", "2026-02-01T12:00:00Z", SP),
    ).toBe(0);
  });
});

describe("intervalos", () => {
  it("companyDateRange é inclusivo e lista os dias", () => {
    const r = companyDateRange("2026-07-14", "2026-07-16", SP);
    expect(r.days).toEqual(["2026-07-14", "2026-07-15", "2026-07-16"]);
    expect(r.start.toISOString()).toBe("2026-07-14T03:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-07-17T02:59:59.999Z");
  });

  it("inverte automaticamente pontas trocadas", () => {
    const r = companyDateRange("2026-07-16", "2026-07-14", SP);
    expect(r.startISO).toBe("2026-07-14");
    expect(r.endISO).toBe("2026-07-16");
  });

  it("mês completo respeita o último dia", () => {
    expect(companyStartOfMonth("2026-02-17", SP).toISOString()).toBe(
      "2026-02-01T03:00:00.000Z",
    );
    expect(companyEndOfMonth("2026-02-17", SP).toISOString()).toBe(
      "2026-03-01T02:59:59.999Z",
    );
    expect(companyMonthRange("2026-02-17", SP).days).toHaveLength(28);
    expect(companyMonthRange("2024-02-17", SP).days).toHaveLength(29);
  });
});

describe("datas ISO", () => {
  it("addDaysStr atravessa mês e ano", () => {
    expect(addDaysStr("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysStr("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("companyDayStartUtc é estável", () => {
    expect(companyDayStartUtc("2026-07-15", SP)).toBe(
      Date.parse("2026-07-15T03:00:00Z"),
    );
    expect(companyDayStartUtc("2026-07-15", UTC)).toBe(
      Date.parse("2026-07-15T00:00:00Z"),
    );
  });

  it("companyTodayISO e companyToday são coerentes", () => {
    const ref = new Date("2026-03-10T02:00:00Z");
    expect(companyTodayISO(SP, ref)).toBe("2026-03-09");
    expect(companyDayKey(companyToday(SP, ref), SP)).toBe("2026-03-09");
    expect(companyTodayISO(UTC, ref)).toBe("2026-03-10");
  });

  it("companyNow retorna o instante atual", () => {
    const before = Date.now();
    const now = companyNow(DEFAULT_COMPANY_TZ).getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
