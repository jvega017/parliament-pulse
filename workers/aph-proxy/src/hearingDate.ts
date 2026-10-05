// Hearing date parse (0.16.2).
//
// The APH "Upcoming Senate hearings" feed (senate/rss/upcoming_hearings)
// carries no <pubDate> and no <guid>, so signals.pub_date is null on every one
// of its rows. The hearing date is printed only at the start of each item's
// <description>, which ingest stores verbatim (trimmed, first 600 chars) in
// signals.description. Measured against the live feed on 5 Oct 2026 (30
// items, fixture tests/fixtures/upcoming-hearings-2026-10-05.json):
//
//   "<Weekday>, <D> <Month> <YYYY> - <venue>"
//   e.g. "Thursday, 1 October 2026 - Committee Room 2S3, Parliament House, Canberra"
//
// 29 of 30 items match that exactly. One prints no space between month and
// year ("Friday, 16 October2026 - ..."), so the month/year gap is \s*. No item
// carries a time of day, so no time is parsed: a time format that has never
// been observed would be a guess.
//
// The result is a civil calendar date (YYYY-MM-DD) exactly as printed. The
// feed states no time zone; the date is the hearing's local day at its venue
// and is never shifted through UTC. A date is returned only when the printed
// weekday agrees with the calendar, so a mistyped day or a non-date that
// happens to fit the shape yields null rather than a wrong date.

const MONTHS: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const HEARING_DATE_RE =
  /^\s*(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*(\d{4})(?:\s+-\s|\s*$)/;

/**
 * Parse the hearing date from an APH Senate hearing description.
 * Returns "YYYY-MM-DD", or null when the description does not open with a
 * valid, weekday-consistent date in the measured format.
 */
export function parseHearingDate(description: string | null | undefined): string | null {
  if (!description) return null;
  const m = HEARING_DATE_RE.exec(description);
  if (!m) return null;
  const [, weekday, dayText, monthName, yearText] = m;
  const day = Number(dayText);
  const month = MONTHS[monthName];
  const year = Number(yearText);
  // Date.UTC is used only as a calendar: it never shifts the printed day.
  const cal = new Date(Date.UTC(year, month - 1, day));
  if (cal.getUTCFullYear() !== year || cal.getUTCMonth() !== month - 1 || cal.getUTCDate() !== day) {
    return null; // e.g. 31 September
  }
  if (WEEKDAYS[cal.getUTCDay()] !== weekday) return null;
  return `${yearText}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
