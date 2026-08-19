// All timestamps arrive as UTC ISO strings; render in Turkey's timezone.
const TZ = 'Europe/Istanbul';

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: TZ,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDate(isoDate: string): string {
  // plain YYYY-MM-DD dates have no timezone component
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** kuruş (INTEGER) → "12.500,50 ₺" */
export function formatKurus(kurus: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(kurus / 100);
}

/** "12500,50" or "12.500,50" (TL) → kuruş INTEGER; null when unparseable */
export function parseTlToKurus(input: string): number | null {
  const cleaned = input.trim().replace(/\./g, '').replace(',', '.');
  if (!cleaned) return null;
  const tl = Number(cleaned);
  if (!Number.isFinite(tl) || tl < 0) return null;
  return Math.round(tl * 100);
}
