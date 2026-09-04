import axios from "axios";

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
