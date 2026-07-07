import { describe, expect, it } from "vitest";
import {
  buildDateRangePreset,
  buildMonthDays,
  formatMonthLabel,
  getMonthBounds,
} from "@/lib/records/dateRanges";

describe("records date ranges", () => {
  const july7 = new Date("2026-07-07T12:00:00.000Z");

  it("defaults calendar ranges to the actual current month", () => {
    expect(buildDateRangePreset("currentMonth", july7)).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
    expect(formatMonthLabel("2026-07")).toBe("July 2026");
  });

  it("builds rolling presets from the provided current date", () => {
    expect(buildDateRangePreset("last30", july7)).toEqual({
      from: "2026-06-08",
      to: "2026-07-07",
    });
    expect(buildDateRangePreset("last90", july7)).toEqual({
      from: "2026-04-09",
      to: "2026-07-07",
    });
    expect(buildDateRangePreset("priorMonth", july7)).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
    });
    expect(buildDateRangePreset("ytd", july7)).toEqual({
      from: "2026-01-01",
      to: "2026-07-07",
    });
  });

  it("places calendar days on their real weekdays", () => {
    const julyDays = buildMonthDays("2026-07");

    expect(julyDays.slice(0, 4)).toEqual([null, null, null, "2026-07-01"]);
    expect(julyDays[9]).toBe("2026-07-07");
    expect(julyDays).toHaveLength(35);

    const februaryDays = buildMonthDays("2026-02");
    expect(februaryDays[0]).toBe("2026-02-01");
    expect(februaryDays.at(-1)).toBe("2026-02-28");
    expect(februaryDays).toHaveLength(28);
  });

  it("uses real month end dates", () => {
    expect(getMonthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(getMonthBounds("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });
});
