/**
 * A one-line summary of a failed upstream call, safe to write to a log.
 *
 * The reason this exists: `console.error("…", error)` on an AxiosError writes
 * the request CONFIG, and the config carries the `apikey` header — so every
 * upstream 422 or timeout printed the live Tequila key into Vercel's logs,
 * where it is retained and forwarded to any log drain. Verified by inspecting
 * a real AxiosError. Never log an error object from an HTTP client; log this.
 */
export function logSafe(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const e = error as {
      message?: unknown;
      code?: unknown;
      response?: { status?: unknown };
    };
    const status = e.response?.status;
    const parts = [
      typeof e.message === "string" ? e.message : undefined,
      typeof e.code === "string" ? `code=${e.code}` : undefined,
      status !== undefined ? `status=${String(status)}` : undefined,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
  }
  return String(error);
}
