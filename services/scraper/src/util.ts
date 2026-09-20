import axios from "axios";

/**
 * Offset of Europe/Oslo from UTC, in minutes, at the given instant
 * (+60 in winter/CET, +120 in summer/CEST — handled automatically).
 */
function osloOffsetMinutes(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Oslo",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return (asUtc - date.getTime()) / 60000;
}

/**
 * Build the correct UTC Date instant for a Europe/Oslo wall-clock date and
 * time. Plain `new Date("2026-08-30T13:00:00")` / `.setHours()` are
 * interpreted in whatever timezone the running process is in (UTC on
 * Railway), not Oslo — that silently shifted every match time by the
 * CET/CEST offset. This goes through Intl instead so it's correct
 * regardless of the server's own timezone.
 */
export function osloLocalToUtcDate(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number
): Date {
  const naiveUtcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = osloOffsetMinutes(naiveUtcGuess);
  return new Date(naiveUtcGuess.getTime() - offsetMinutes * 60000);
}

/**
 * Summarize an error into a short, loggable string. Axios errors in
 * particular carry huge circular objects (sockets, streams, the full
 * response body) that flood the log if passed to console.error directly —
 * that once caused Railway to drop 100k+ log lines and throttle the
 * deployment. Never log a raw caught error; always go through this.
 */
export function formatError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const statusText = err.response?.statusText;
    const url = err.config?.url;
    const bodySnippet =
      typeof err.response?.data === "string"
        ? err.response.data.replace(/\s+/g, " ").trim().slice(0, 200)
        : undefined;
    return [
      `HTTP ${status ?? "?"} ${statusText ?? ""} on ${url ?? "unknown url"}`.trim(),
      bodySnippet ? `body: ${bodySnippet}` : null,
    ]
      .filter(Boolean)
      .join(" — ");
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
