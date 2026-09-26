import { CliError } from "./errors.js";

const DURATION_PATTERN = /^(\d+[wdhm]\s*)+$/i;
const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9_]*-\d+$/i;

/** Validates a Jira duration such as "2h", "1d 4h" or "1h30m". */
export function parseDuration(value: string): string {
  const trimmed = value.trim();
  if (!DURATION_PATTERN.test(trimmed)) {
    throw new CliError(
      `Invalid duration "${value}". Use Jira units w/d/h/m, for example "2h", "1d" or "1h 30m".`
    );
  }
  return trimmed;
}

/** Validates and upper-cases an issue key such as "eng-123". */
export function parseIssueKey(value: string): string {
  const trimmed = value.trim();
  if (!ISSUE_KEY_PATTERN.test(trimmed)) {
    throw new CliError(`Invalid issue key "${value}". Expected something like "ENG-123".`);
  }
  return trimmed.toUpperCase();
}

/** Parses any date string JavaScript understands (e.g. ISO 8601). */
export function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CliError(`Invalid date "${value}". Use ISO 8601, for example "2026-09-26T10:00:00".`);
  }
  return date;
}

/**
 * Formats a date the way Jira's worklog API requires:
 * yyyy-MM-ddTHH:mm:ss.SSS+hhmm, in the local time zone.
 */
export function toJiraDateTime(date: Date): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`
  );
}

/** Normalizes a Jira site URL to "https://host" with no trailing slash. */
export function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new CliError(`Invalid URL "${value}". Expected something like https://yoursite.atlassian.net`);
  }
  if (url.protocol !== "https:") {
    throw new CliError("The Jira URL must start with https://");
  }
  return url.origin;
}
