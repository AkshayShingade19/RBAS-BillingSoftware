import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Undo2, Banknote } from 'lucide-react';
import { api, getErrorMessage, downloadCsv } from '@/lib/api';
import { Payment, Paginated } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/SearchInput';
import { DataTable, Column } from '@/components/ui/Table';
import { Card } from '@/components/ui/Card';
import { RecordPaymentForm } from '@/components/forms/RecordPaymentForm';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/auth';
import { formatDate, formatMoney } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [voiding, setVoiding] = useState<Payment | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page, limit, debouncedSearch, methodFilter],
    queryFn: async () =>
      (
        await api.get<Paginated<Payment>>('/payments', {
          params: { page, limit, search: debouncedSearch || undefined, method: methodFilter || undefined },
        })
      ).data,
  });

  useEffect(() => setPage(1), [debouncedSearch, methodFilter]);

  const voidMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/payments/${id}/void`),
    onSuccess: async () => {
      toast.success('Payment voided');
      setVoiding(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payments'] }),
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
      ]);
    },
    onError: (err) => toast.error('Could not void payment', getErrorMessage(err)),
  });

  const columns: Column<Payment>[] = [
    {
      key: 'number',
      header: 'Payment',
      render: (p) => (
        <div>
          <p className="text-sm font-semibold text-ink-900">{p.paymentNumber}</p>
          <p className="text-xs text-ink-400">{formatDate(p.paidAt)}</p>
        </div>
      ),
    },
    {
      key: 'invoice',
      header: 'Invoice',
      render: (p) => (
        <Link to={`/invoices/${p.invoiceId}`} className="text-sm font-medium text-brand-600 hover:underline">
          {p.invoiceId ? 'View invoice' : '—'}
        </Link>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (p) => <span className="text-sm text-ink-600">{p.clientName || '—'}</span>,
    },
    {
      key: 'method',
      header: 'Method',
      render: (p) => <Badge>{p.method}</Badge>,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (p) => <span className="text-sm font-semibold text-ink-900">{formatMoney(p.amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) =>
        hasPermission('payment.update') && p.status === 'completed' ? (
          <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => setVoiding(p)} aria-label="Void">
            <Undo2 className="h-4 w-4" />
          </Button>
        ) : (
          <span className="text-xs text-ink-300">—</span>
        ),
    },
  ];

  const handleVoid = () => {
    if (!voiding) return;
    setVoidLoading(true);
    voidMutation.mutate(voiding.id, { onSettled: () => setVoidLoading(false) });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Money received against invoices."
        actions={
          hasPermission('invoice.update') && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Record payment
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search payments…" className="w-full max-w-xs" />
          <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} className="input-base w-auto">
            <option value="">All methods</option>
            <option value="card">Card</option>
            <option value="bank">Bank transfer</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => downloadCsv('/payments/export', { search, method: methodFilter })}>
            Export CSV
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          loading={isLoading}
          emptyIcon={<Banknote className="h-10 w-10" />}
          emptyTitle="No payments recorded"
          emptyDescription="Record a payment against an invoice to track money in."
          emptyAction={hasPermission('invoice.update') && <Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Record payment</Button>}
          rowKey={(p) => p.id}
        />
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={limit} onChange={setPage} />}
      </Card>

      {modalOpen && <PaymentFormModal onClose={() => setModalOpen(false)} />}

      <ConfirmDialog
        open={Boolean(voiding)}
        onClose={() => setVoiding(null)}
        onConfirm={handleVoid}
        loading={voidLoading}
        title="Void payment"
        message={`This will reverse payment ${voiding?.paymentNumber} and restore the invoice balance. Continue?`}
        confirmLabel="Void payment"
        danger
      />
    </div>
  );
}

function PaymentFormModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Record a payment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="record-payment-form">Record payment</Button>
        </>
      }
    >
      <RecordPaymentForm onSuccess={onClose} />
    </Modal>
  );
}