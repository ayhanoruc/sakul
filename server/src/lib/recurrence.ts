// Recurrence mini-format (deliberately not cron):
//   her_gun            — daily, same TRT time
//   her_hafta:pzt      — weekly on a TRT weekday (pzt sal car per cum cmt paz)
//   her_ay:26          — monthly on day N (clamped to short months), same TRT time
import { toTrt, fromTrt } from './time.js';

const WEEKDAYS = ['paz', 'pzt', 'sal', 'car', 'per', 'cum', 'cmt']; // getUTCDay() order

export function isValidRule(rule: string): boolean {
  if (rule === 'her_gun') return true;
  const hafta = rule.match(/^her_hafta:(pzt|sal|car|per|cum|cmt|paz)$/);
  if (hafta) return true;
  const ay = rule.match(/^her_ay:([1-9]|[12]\d|3[01])$/);
  return ay !== null;
}

/**
 * The next occurrence strictly after `from` (UTC), computed in TRT.
 * `from` is the occurrence that just fired.
 */
export function nextOccurrence(rule: string, from: Date): Date {
  const trt = toTrt(from); // work in TRT via UTC getters

  if (rule === 'her_gun') {
    trt.setUTCDate(trt.getUTCDate() + 1);
    return fromTrt(trt);
  }

  const hafta = rule.match(/^her_hafta:(\w+)$/);
  if (hafta) {
    const target = WEEKDAYS.indexOf(hafta[1]);
    let delta = (target - trt.getUTCDay() + 7) % 7;
    if (delta === 0) delta = 7; // strictly after
    trt.setUTCDate(trt.getUTCDate() + delta);
    return fromTrt(trt);
  }

  const ay = rule.match(/^her_ay:(\d+)$/);
  if (ay) {
    const day = Number(ay[1]);
    const year = trt.getUTCFullYear();
    const month = trt.getUTCMonth();
    // candidate in the CURRENT month first (clamped): "her_ay:26" fired on the
    // 20th must give the 26th of this month, not skip a month
    const thisMonthLen = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const candidate = new Date(trt);
    candidate.setUTCDate(Math.min(day, thisMonthLen));
    if (candidate > trt) return fromTrt(candidate);
    // otherwise next month (clamped to its length)
    const nextMonthLen = new Date(Date.UTC(year, month + 2, 0)).getUTCDate();
    const next = new Date(trt);
    next.setUTCDate(1); // avoid overflow while switching months
    next.setUTCMonth(month + 1);
    next.setUTCDate(Math.min(day, nextMonthLen));
    return fromTrt(next);
  }

  throw new Error(`invalid recurrence rule: ${rule}`);
}
