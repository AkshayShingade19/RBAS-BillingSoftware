import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileText } from 'lucide-react';
import { api, downloadCsv } from '@/lib/api';
import { Invoice, Paginated } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/SearchInput';
import { DataTable, Column } from '@/components/ui/Table';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/store/auth';
import { formatMoney, formatDate } from '@/lib/utils';

const STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'];

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, limit, debouncedSearch, statusFilter],
    queryFn: async () =>
      (
        await api.get<Paginated<Invoice>>('/invoices', {
          params: { page, limit, search: debouncedSearch || undefined, status: statusFilter || undefined },
        })
      ).data,
  });

  useEffect(() => setPage(1), [debouncedSearch, statusFilter]);

  const columns: Column<Invoice>[] = [
    {
      key: 'number',
      header: 'Invoice',
      render: (i) => (
        <button onClick={() => navigate(`/invoices/${i.id}`)} className="text-left">
          <span className="block text-sm font-semibold text-ink-900 hover:text-brand-700">{i.invoiceNumber}</span>
          <span className="block text-xs text-ink-400">Issued {formatDate(i.issueDate)}</span>
        </button>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (i) => <span className="text-sm text-ink-600">{i.clientName}</span>,
    },
    {
      key: 'due',
      header: 'Due date',
      render: (i) => <span className="text-sm text-ink-600">{formatDate(i.dueDate)}</span>,
    },
    {
      key: 'total',
      header: 'Total',
      render: (i) => <span className="text-sm font-semibold text-ink-900">{formatMoney(i.total)}</span>,
    },
    {
      key: 'balance',
      header: 'Balance',
      render: (i) =>
        i.balanceDue > 0 ? (
          <span className="text-sm font-medium text-amber-600">{formatMoney(i.balanceDue)}</span>
        ) : (
          <span className="text-xs text-ink-300">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (i) => <StatusBadge status={i.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        subtitle="Bill your clients and track what's owed."
        actions={
          hasPermission('invoice.create') && (
            <Button onClick={() => navigate('/invoices/new')}>
              <Plus className="h-4 w-4" /> New invoice
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search invoices…" className="w-full max-w-xs" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base w-auto">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => downloadCsv('/invoices/export', { search, status: statusFilter })}>
            Export CSV
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          loading={isLoading}
          emptyIcon={<FileText className="h-10 w-10" />}
          emptyTitle="No invoices yet"
          emptyDescription="Create your first invoice to start billing."
          emptyAction={hasPermission('invoice.create') && <Button onClick={() => navigate('/invoices/new')}><Plus className="h-4 w-4" /> New invoice</Button>}
          rowKey={(i) => i.id}
        />
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={limit} onChange={setPage} />}
      </Card>
    </div>
  );
}