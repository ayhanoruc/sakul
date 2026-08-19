/** kuruş (INTEGER) → "₺150.000,00" — for push titles and digests. */
const fmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

export function formatKurus(kurus: number): string {
  return fmt.format(kurus / 100);
}
