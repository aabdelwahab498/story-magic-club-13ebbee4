/**
 * Compute the next Sunday 23:59 UTC as the weekly competition deadline.
 * Stable per week so the countdown doesn't drift between renders.
 */
export function getWeeklyDeadline(): Date {
  const now = new Date();
  const d = new Date(now);
  const day = d.getUTCDay();
  const daysUntilSunday = (7 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilSunday);
  d.setUTCHours(23, 59, 0, 0);
  return d;
}
