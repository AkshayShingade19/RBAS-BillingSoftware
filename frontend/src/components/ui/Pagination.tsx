import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { paginationWindow } from '@/lib/utils';

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <div className="px-5 py-3 text-xs text-ink-400">
        Showing {total} {total === 1 ? 'result' : 'results'}
      </div>
    );
  }

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const pages = paginationWindow(page, totalPages);

  return (
    <div className="flex items-center justify-between border-t border-ink-100 px-5 py-3">
      <p className="text-xs text-ink-500">
        Showing <span className="font-medium text-ink-700">{from}–{to}</span> of{' '}
        <span className="font-medium text-ink-700">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`h-8 min-w-8 rounded-md px-2 text-sm font-medium transition ${
              p === page
                ? 'bg-brand-600 text-white'
                : 'text-ink-600 hover:bg-ink-100'
            }`}
          >
            {p}
          </button>
        ))}
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}