/**
 * Timestamp parsing utilities
 */

/**
 * Convert a timestamp string to seconds.
 * Supports "MM:SS" and "HH:MM:SS".
 */
export function parseTimestampToSeconds(ts: string): number {
  if (!ts) return 0;
  const parts = ts.trim().split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

/**
 * Convert seconds to "HH:MM:SS" timestamp.
 */
export function secondsToTimestamp(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Parse a duration string like "1:30:45" or "25:30" to seconds.
 * Used for SerpAPI duration filtering.
 */
export function parseDurationToSeconds(duration: string): number {
  if (!duration) return 0;
  return parseTimestampToSeconds(duration);
}
