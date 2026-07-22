import type { DateRange } from "./types";
import { addDays, toUtcDate } from "./calculations";

export type DateRangePreset = "currentMonth" | "last30" | "last90" | "priorMonth" | "ytd";
export const defaultRecordsTimezone = "UTC";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function isValidTimeZone(timeZone?: string) {
  if (!timeZone) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function safeRecordsTimezone(timeZone?: string) {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : defaultRecordsTimezone;
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  return `${year}-${month}-${day}`;
}

export function formatLocalDate(date = new Date(), timeZone?: string) {
  if (timeZone) return formatDateInTimeZone(date, safeRecordsTimezone(timeZone));
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function monthKeyFromDate(date: string, timeZone?: string) {
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : formatLocalDate(new Date(), timeZone).slice(0, 7);
}

export function getMonthBounds(monthKey: string, timeZone?: string): DateRange {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return getMonthBounds(formatLocalDate(new Date(), timeZone).slice(0, 7), timeZone);
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${yearText}-${monthText}-01`,
    to: `${yearText}-${monthText}-${pad2(lastDay)}`,
  };
}

export function formatMonthLabel(monthKey: string, timeZone?: string) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return formatMonthLabel(formatLocalDate(new Date(), timeZone).slice(0, 7), timeZone);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function buildDateRangePreset(preset: DateRangePreset, now = new Date(), timeZone?: string): DateRange {
  const today = formatLocalDate(now, timeZone);
  if (preset === "last30") return { from: addDays(today, -29), to: today };
  if (preset === "last90") return { from: addDays(today, -89), to: today };
  if (preset === "priorMonth") {
    const currentMonth = getMonthBounds(today.slice(0, 7));
    return getMonthBounds(addDays(currentMonth.from, -1).slice(0, 7));
  }
  if (preset === "ytd") return { from: `${today.slice(0, 4)}-01-01`, to: today };
  return getMonthBounds(today.slice(0, 7));
}

export function currentMonthKey(now = new Date(), timeZone?: string) {
  return formatLocalDate(now, timeZone).slice(0, 7);
}

export function shiftMonthKey(monthKey: string, offset: number, timeZone?: string) {
  const bounds = getMonthBounds(monthKey, timeZone);
  const [year, month] = bounds.from.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}`;
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
