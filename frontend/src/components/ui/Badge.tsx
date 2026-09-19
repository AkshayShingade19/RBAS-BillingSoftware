import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeTone = 'neutral' | 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'slate' | 'brand';

export const badgeToneClass: Record<BadgeTone, string> = {
  neutral: 'bg-ink-100 text-ink-700',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-red-50 text-red-700 ring-red-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  blue: 'bg-blue-50 text-blue-700 ring-blue-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
  slate: 'bg-slate-100 text-slate-700',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/20',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  const toneClass = badgeToneClass[tone] ?? badgeToneClass.neutral;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        toneClass,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'active':
    case 'paid':
    case 'accepted':
    case 'approved':
    case 'completed':
      return 'green';
    case 'overdue':
    case 'void':
    case 'voided':
    case 'rejected':
    case 'suspended':
      return 'red';
    case 'partial':
    case 'expired':
    case 'pending':
      return 'amber';
    case 'sent':
      return 'blue';
    case 'draft':
    case 'inactive':
    case 'other':
      return 'slate';
    case 'converted':
      return 'violet';
    default:
      return 'neutral';
  }
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{status}</Badge>;
}