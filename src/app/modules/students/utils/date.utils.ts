/**
 * Safely extracts timestamp in milliseconds from various possible formats:
 * Firestore Timestamp, JS Date, ISO String, Number, or object with seconds.
 */
export function getMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.toDate === 'function') return ts.toDate().getTime();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const parsed = new Date(ts).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return 0;
}

/**
 * Safely formats a timestamp to a local date string (e.g. "8/11/2026").
 */
export function formatTimestampDate(ts: any, fallback = 'N/A'): string {
  const ms = getMillis(ts);
  if (!ms) return fallback;
  return new Date(ms).toLocaleDateString();
}

/**
 * Safely formats a timestamp to a local date and time string.
 */
export function formatTimestampDateTime(ts: any, fallback = 'N/A'): string {
  const ms = getMillis(ts);
  if (!ms) return fallback;
  return new Date(ms).toLocaleString();
}
