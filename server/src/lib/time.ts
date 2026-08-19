// Turkey is UTC+3 with no DST (since 2016) — a fixed offset is correct and simple.
const TRT_OFFSET_MS = 3 * 3600_000;

export function toTrt(utc: Date): Date {
  return new Date(utc.getTime() + TRT_OFFSET_MS);
}

export function fromTrt(trt: Date): Date {
  return new Date(trt.getTime() - TRT_OFFSET_MS);
}

/** YYYY-MM-DD of the given instant, in Turkey's timezone. */
export function trtDateOf(utc: Date): string {
  return toTrt(utc).toISOString().slice(0, 10);
}

/** UTC instant of `HH:00` TRT on a TRT calendar date ("2026-08-20", 7) → 04:00Z. */
export function utcAtTrtHour(trtDate: string, hour: number): Date {
  const [y, m, d] = trtDate.split('-').map(Number);
  return fromTrt(new Date(Date.UTC(y, m - 1, d, hour, 0, 0)));
}

/** UTC instant of the end of a TRT calendar day (23:59:59.999). */
export function utcAtTrtEndOfDay(trtDate: string): Date {
  const [y, m, d] = trtDate.split('-').map(Number);
  return fromTrt(new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999)));
}

/** Add whole days to a YYYY-MM-DD date string. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}
