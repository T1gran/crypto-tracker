import { describe, expect, it } from "@jest/globals";
import { normalizeHistoryRange } from "../utils/date-time";
import { AppError } from "../errors/app-error";

describe("UTC history date normalization", () => {
  it.each([
    ["2026-10-08T10:00:00Z", "2026-10-08T10:00:00.000Z"],
    ["2026-10-08T17:00:00.123+07:00", "2026-10-08T10:00:00.123Z"],
    ["2026-10-08T06:00:00.123-04:00", "2026-10-08T10:00:00.123Z"],
    ["2026-10-08T00:30:00+07:00", "2026-10-07T17:30:00.000Z"],
    ["2026-10-08T23:30:00-04:00", "2026-10-09T03:30:00.000Z"],
    ["2026-10-08T10:00:00.1Z", "2026-10-08T10:00:00.100Z"],
    ["2026-10-08T10:00:00.12Z", "2026-10-08T10:00:00.120Z"],
    ["2024-02-29T00:00:00Z", "2024-02-29T00:00:00.000Z"],
    ["2000-02-29T00:00:00Z", "2000-02-29T00:00:00.000Z"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeHistoryRange(input, input)).toEqual({ from: expected, to: expected });
  });

  it("expands a date-only range to a complete UTC day", () => {
    expect(normalizeHistoryRange("2026-10-08", "2026-10-08")).toEqual({
      from: "2026-10-08T00:00:00.000Z",
      to: "2026-10-08T23:59:59.999Z",
    });
  });

  it("compares range order after converting offsets to UTC", () => {
    expect(normalizeHistoryRange("2026-10-08T17:00:00+07:00", "2026-10-08T11:00:00Z"))
      .toEqual({ from: "2026-10-08T10:00:00.000Z", to: "2026-10-08T11:00:00.000Z" });
    expect(() => normalizeHistoryRange("2026-10-08T10:00:00Z", "2026-10-08T16:00:00+07:00"))
      .toThrow(AppError);
  });

  it.each([
    "", "not-a-date", "2026-02-30", "2026-02-29", "1900-02-29", "2026-04-31",
    "2026-00-08", "2026-13-08", "2026-10-00", "2026-10-32",
    "2026-10-08T10:00:00", "2026-10-08T10:00Z", "2026-10-08 10:00:00Z",
    "2026-10-08T24:00:00Z", "2026-10-08T10:60:00Z", "2026-10-08T10:00:60Z",
    "2026-10-08T10:00:00+24:00", "2026-10-08T10:00:00+07:60",
    "2026-10-08T10:00:00.1234Z",
  ])("rejects invalid or ambiguous date %p", (input) => {
    expect(() => normalizeHistoryRange(input)).toThrow(AppError);
    expect(() => normalizeHistoryRange(undefined, input)).toThrow(AppError);
  });

  it.each([null, false, 123, [], {}].map((input) => [input]))(
    "rejects a non-string date %p", (input) => {
      expect(() => normalizeHistoryRange(input)).toThrow(AppError);
    },
  );
});
