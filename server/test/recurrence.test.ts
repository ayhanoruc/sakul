import { describe, it, expect } from 'vitest';
import { nextOccurrence, isValidRule } from '../src/lib/recurrence.js';
import { trtDateOf, utcAtTrtHour, addDays } from '../src/lib/time.js';

describe('time helpers (TRT = UTC+3, no DST)', () => {
  it('trtDateOf rolls the date at 21:00 UTC', () => {
    expect(trtDateOf(new Date('2026-08-20T20:59:00Z'))).toBe('2026-08-20');
    expect(trtDateOf(new Date('2026-08-20T21:00:00Z'))).toBe('2026-08-21'); // 00:00 TRT next day
  });

  it('utcAtTrtHour: 07:00 TRT is 04:00 UTC', () => {
    expect(utcAtTrtHour('2026-08-20', 7).toISOString()).toBe('2026-08-20T04:00:00.000Z');
  });

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29'); // leap year
  });
});

describe('recurrence rules', () => {
  it('validates the mini-format strictly', () => {
    expect(isValidRule('her_gun')).toBe(true);
    expect(isValidRule('her_hafta:pzt')).toBe(true);
    expect(isValidRule('her_ay:26')).toBe(true);
    expect(isValidRule('her_ay:31')).toBe(true);
    expect(isValidRule('her_ay:0')).toBe(false);
    expect(isValidRule('her_ay:32')).toBe(false);
    expect(isValidRule('her_hafta:xyz')).toBe(false);
    expect(isValidRule('cron:* * *')).toBe(false);
    expect(isValidRule('')).toBe(false);
  });

  it('her_gun advances exactly one day, preserving TRT time', () => {
    // 09:00 TRT = 06:00 UTC
    const next = nextOccurrence('her_gun', new Date('2026-08-20T06:00:00Z'));
    expect(next.toISOString()).toBe('2026-08-21T06:00:00.000Z');
  });

  it('her_gun crosses a month boundary', () => {
    const next = nextOccurrence('her_gun', new Date('2026-08-31T06:00:00Z'));
    expect(next.toISOString()).toBe('2026-09-01T06:00:00.000Z');
  });

  it('her_hafta:pzt from a Monday jumps a full week (strictly after)', () => {
    // 2026-08-24 is a Monday; 10:00 TRT = 07:00 UTC
    const next = nextOccurrence('her_hafta:pzt', new Date('2026-08-24T07:00:00Z'));
    expect(next.toISOString()).toBe('2026-08-31T07:00:00.000Z');
    expect(trtDateOf(next)).toBe('2026-08-31');
  });

  it('her_hafta:cum from a Monday lands on the coming Friday', () => {
    const next = nextOccurrence('her_hafta:cum', new Date('2026-08-24T07:00:00Z'));
    expect(trtDateOf(next)).toBe('2026-08-28'); // Friday same week
  });

  it('her_hafta weekday is computed in TRT, not UTC', () => {
    // 2026-08-24 22:00 UTC = 2026-08-25 01:00 TRT (Tuesday in TRT, still Monday in UTC)
    const next = nextOccurrence('her_hafta:sal', new Date('2026-08-24T22:00:00Z'));
    // strictly after a TRT-Tuesday → next TRT-Tuesday
    expect(trtDateOf(next)).toBe('2026-09-01');
  });

  it('her_ay:26 advances month by month (SGK bildirgesi case)', () => {
    const next = nextOccurrence('her_ay:26', new Date('2026-08-26T05:00:00Z'));
    expect(trtDateOf(next)).toBe('2026-09-26');
  });

  it('her_ay:31 clamps to short months instead of skipping them', () => {
    const next = nextOccurrence('her_ay:31', new Date('2026-08-31T05:00:00Z'));
    expect(trtDateOf(next)).toBe('2026-09-30'); // September has 30 days
  });

  it('her_ay:30 clamps to Feb 28 in a non-leap year', () => {
    const next = nextOccurrence('her_ay:30', new Date('2027-01-30T05:00:00Z'));
    expect(trtDateOf(next)).toBe('2027-02-28');
  });

  it('her_ay does not double-skip after a clamped month', () => {
    // fired on Sep 30 (clamped from 31) → October has 31 → back to the 31st
    const next = nextOccurrence('her_ay:31', new Date('2026-09-30T05:00:00Z'));
    expect(trtDateOf(next)).toBe('2026-10-31');
  });

  it('throws on an invalid rule', () => {
    expect(() => nextOccurrence('her_yil:1', new Date())).toThrow();
  });
});
