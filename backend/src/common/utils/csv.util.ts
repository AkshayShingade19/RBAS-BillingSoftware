export const escapeCsv = (value: unknown): string => {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: Record<string, unknown>[]): string => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = rows.map((row) => headers.map((h) => escapeCsv(row[h])).join(','));
  return [headers.map(escapeCsv).join(','), ...lines].join('\r\n');
};