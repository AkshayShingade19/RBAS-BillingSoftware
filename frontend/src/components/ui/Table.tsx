import { ReactNode } from 'react';
import { Card, CardHeader } from './Card';

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export function DataTable<T>({
  columns,
  rows,
  loading,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyIcon?: ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  rowKey: (row: T) => string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-500">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink-200 border-t-brand-600" />
        Loading…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        {emptyIcon && <div className="mb-4 text-ink-300">{emptyIcon}</div>}
        <h3 className="text-base font-semibold text-ink-900">{emptyTitle}</h3>
        {emptyDescription && <p className="mt-1 max-w-sm text-sm text-ink-500">{emptyDescription}</p>}
        {emptyAction && <div className="mt-5">{emptyAction}</div>}
      </div>
    );
  }

  const alignClass = { left: 'text-left', right: 'text-right', center: 'text-center' };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-ink-100 bg-ink-50/50">
            {columns.map((col) => (
              <th key={col.key} className={`th ${alignClass[col.align ?? 'left']}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="transition hover:bg-brand-50/40">
              {columns.map((col) => (
                <td key={col.key} className={`td ${alignClass[col.align ?? 'left']}`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableShell({
  title,
  subtitle,
  actions,
  children,
  pagination,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  pagination?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} actions={actions} />
      {children}
      {pagination}
    </Card>
  );
}