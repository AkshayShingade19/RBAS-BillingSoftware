import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, NotebookPen } from 'lucide-react';
import { api, downloadCsv } from '@/lib/api';
import { Quote, Paginated } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/SearchInput';
import { DataTable, Column } from '@/components/ui/Table';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/store/auth';
import { formatMoney, formatDate } from '@/lib/utils';

const STATUSES = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'];

export default function QuotesPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading } = useQuery({
    queryKey: ['quotes', page, limit, debouncedSearch, statusFilter],
    queryFn: async () =>
      (
        await api.get<Paginated<Quote>>('/quotes', {
          params: { page, limit, search: debouncedSearch || undefined, status: statusFilter || undefined },
        })
      ).data,
  });

  useEffect(() => setPage(1), [debouncedSearch, statusFilter]);

  const columns: Column<Quote>[] = [
    {
      key: 'number',
      header: 'Quote',
      render: (q) => (
        <button onClick={() => navigate(`/quotes/${q.id}`)} className="text-left">
          <span className="block text-sm font-semibold text-ink-900 hover:text-brand-700">{q.quoteNumber}</span>
          <span className="block text-xs text-ink-400">Issued {formatDate(q.issueDate)}</span>
        </button>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (q) => <span className="text-sm text-ink-600">{q.clientName}</span>,
    },
    {
      key: 'valid',
      header: 'Valid until',
      render: (q) => <span className="text-sm text-ink-600">{formatDate(q.validUntil)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (q) => <span className="text-sm font-semibold text-ink-900">{formatMoney(q.total)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (q) => <StatusBadge status={q.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        subtitle="Send estimates before you bill."
        actions={
          hasPermission('quote.create') && (
            <Button onClick={() => navigate('/quotes/new')}>
              <Plus className="h-4 w-4" /> New quote
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search quotes…" className="w-full max-w-xs" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base w-auto">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => downloadCsv('/quotes/export', { search, status: statusFilter })}>
            Export CSV
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          loading={isLoading}
          emptyIcon={<NotebookPen className="h-10 w-10" />}
          emptyTitle="No quotes yet"
          emptyDescription="Create a quote to share pricing with a client."
          emptyAction={hasPermission('quote.create') && <Button onClick={() => navigate('/quotes/new')}><Plus className="h-4 w-4" /> New quote</Button>}
          rowKey={(q) => q.id}
        />
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={limit} onChange={setPage} />}
      </Card>
    </div>
  );
}