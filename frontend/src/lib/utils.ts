import { clsx, type ClassValue } from 'clsx';
import dayjs from 'dayjs';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatMoney(value: number | string | undefined, currency = 'USD'): string {
  const n = Number(value) || 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function formatNumber(value: number | string | undefined): string {
  const n = Number(value) || 0;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
}

export function formatDate(value?: string | Date | null, format = 'MMM D, YYYY'): string {
  if (!value) return '—';
  const d = dayjs(value);
  return d.isValid() ? d.format(format) : '—';
}

export function formatDateTime(value?: string | Date | null): string {
  return formatDate(value, 'MMM D, YYYY h:mm A');
}

export function timeAgo(value?: string | Date | null): string {
  if (!value) return '—';
  const d = dayjs(value);
  if (!d.isValid()) return '—';
  const diff = Date.now() - d.valueOf();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.format('MMM D, YYYY');
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function paginationWindow(page: number, totalPages: number): number[] {
  const pages: number[] = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i += 1) pages.push(i);
  return pages;
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv') {
  const blobUrl = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}