import type { DateRange } from "./types";
import { addDays, toUtcDate } from "./calculations";

export type DateRangePreset = "currentMonth" | "last30" | "last90" | "priorMonth" | "ytd";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatLocalDate(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function monthKeyFromDate(date: string) {
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : formatLocalDate().slice(0, 7);
}

export function getMonthBounds(monthKey: string): DateRange {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return getMonthBounds(formatLocalDate().slice(0, 7));
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${yearText}-${monthText}-01`,
    to: `${yearText}-${monthText}-${pad2(lastDay)}`,
  };
}

export function formatMonthLabel(monthKey: string) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return formatMonthLabel(formatLocalDate().slice(0, 7));
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function buildDateRangePreset(preset: DateRangePreset, now = new Date()): DateRange {
  const today = formatLocalDate(now);
  if (preset === "last30") return { from: addDays(today, -29), to: today };
  if (preset === "last90") return { from: addDays(today, -89), to: today };
  if (preset === "priorMonth") {
    const currentMonth = getMonthBounds(today.slice(0, 7));
    return getMonthBounds(addDays(currentMonth.from, -1).slice(0, 7));
  }
  if (preset === "ytd") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return getMonthBounds(today.slice(0, 7));
}

export function buildMonthDays(monthKey: string) {
  const monthRange = getMonthBounds(monthKey);
  const firstDay = toUtcDate(monthRange.from).getUTCDay();
  const daysInMonth = Number(monthRange.to.slice(-2));
  const days: Array<string | null> = Array.from({ length: firstDay }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(`${monthRange.from.slice(0, 8)}${pad2(day)}`);
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}
