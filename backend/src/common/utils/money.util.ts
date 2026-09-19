export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const formatMoney = (amount: number, currency = 'USD'): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(round2(amount ?? 0));

export const toFloat = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? round2(n) : 0;
};