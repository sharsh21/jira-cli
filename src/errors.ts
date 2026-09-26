import axios from "axios";

/** An expected, user-facing failure. Printed without a stack trace. */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

interface JiraErrorBody {
  errorMessages?: unknown;
  errors?: Record<string, unknown>;
}

const STATUS_HINTS: Record<number, string> = {
  401: "Authentication failed. Check your email and API token with 'jira-cli config init'.",
  403: "Permission denied. Your Jira account can't perform this action.",
  404: "Not found. Check the issue or project key, your Jira site URL, and that you have access.",
};

/** Turns any thrown value into a single readable line. */
export function formatError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as JiraErrorBody | undefined;
    const parts: string[] = [];

    if (body && Array.isArray(body.errorMessages)) {
      parts.push(...body.errorMessages.map(String));
    }
    if (body?.errors && typeof body.errors === "object") {
      parts.push(...Object.entries(body.errors).map(([field, msg]) => `${field}: ${String(msg)}`));
    }
    if (parts.length > 0) return parts.join("; ");

    const status = err.response?.status;
    if (status && STATUS_HINTS[status]) return STATUS_HINTS[status];
    if (!err.response) return `Could not reach Jira: ${err.message}`;
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
