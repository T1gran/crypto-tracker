import { AppError } from "../errors/app-error";

const HISTORY_DATE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2}))?$/;

function normalizeHistoryDate(
  value: unknown,
  upperBound: boolean,
): string | undefined {
  if (value === undefined) return undefined;
  const match = typeof value === "string" ? HISTORY_DATE_PATTERN.exec(value) : null;
  if (!match) throw invalidDate();

  const [, year, month, day, hour, minute, second, , timezone] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const leapYear = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (m < 1 || m > 12 || d < 1 || d > daysInMonth[m - 1]!) throw invalidDate();
  if (hour !== undefined) {
    if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
      throw invalidDate();
    }
    if (
      timezone !== "Z" &&
      (Number(timezone!.slice(1, 3)) > 23 || Number(timezone!.slice(4, 6)) > 59)
    ) {
      throw invalidDate();
    }
  }

  const timestamp =
    hour === undefined
      ? `${value}T${upperBound ? "23:59:59.999" : "00:00:00.000"}Z`
      : (value as string);
  const milliseconds = Date.parse(timestamp);
  if (!Number.isFinite(milliseconds)) throw invalidDate();
  const normalized = new Date(milliseconds).toISOString();
  // Fixed-width UTC strings retain chronological order in indexed SQL comparisons.
  if (!/^\d{4}-/.test(normalized)) throw invalidDate();
  return normalized;
}

function invalidDate(): AppError {
  return new AppError(
    "Bad request: 'from' and 'to' must be valid dates (YYYY-MM-DD) or date-times with seconds and Z or an explicit timezone offset",
    400,
  );
}

export function normalizeHistoryRange(from?: unknown, to?: unknown): {
  from?: string;
  to?: string;
} {
  const normalizedFrom = normalizeHistoryDate(from, false);
  const normalizedTo = normalizeHistoryDate(to, true);
  if (normalizedFrom && normalizedTo && normalizedFrom > normalizedTo) {
    throw new AppError("Bad request: 'from' must not be later than 'to'", 400);
  }
  return { from: normalizedFrom, to: normalizedTo };
}
