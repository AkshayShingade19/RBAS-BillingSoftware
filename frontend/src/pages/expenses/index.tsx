import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Wallet } from 'lucide-react';
import { api, getErrorMessage, downloadCsv } from '@/lib/api';
import { Expense, Paginated } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/SearchInput';
import { DataTable, Column } from '@/components/ui/Table';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/auth';
import { formatMoney, formatDate } from '@/lib/utils';

const schema = z.object({
  category: z.string().min(1, 'Category is required').max(100),
  vendor: z.string().max(200).optional().or(z.literal('')),
  amount: z.coerce.number({ invalid_type_error: 'Amount is required' }).min(0.01, 'Amount must be at least 0.01'),
  expenseDate: z.string().min(1, 'Date is required'),
  method: z.enum(['card', 'bank', 'cash', 'other']),
  status: z.enum(['pending', 'approved', 'rejected']),
  note: z.string().max(1000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  category: '',
  vendor: '',
  amount: 0,
  expenseDate: new Date().toISOString().slice(0, 10),
  method: 'other',
  status: 'pending',
  note: '',
};

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', page, limit, debouncedSearch, statusFilter],
    queryFn: async () =>
      (
        await api.get<Paginated<Expense>>('/expenses', {
          params: { page, limit, search: debouncedSearch || undefined, status: statusFilter || undefined },
        })
      ).data,
  });

  useEffect(() => setPage(1), [debouncedSearch, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: async () => {
      toast.success('Expense deleted');
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (err) => toast.error('Could not delete expense', getErrorMessage(err)),
  });

  const columns: Column<Expense>[] = [
    {
      key: 'category',
      header: 'Category',
      render: (e) => (
        <div>
          <p className="text-sm font-semibold text-ink-900">{e.category}</p>
          {e.vendor && <p className="text-xs text-ink-400">{e.vendor}</p>}
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (e) => <span className="text-sm text-ink-600">{formatDate(e.expenseDate)}</span>,
    },
    {
      key: 'method',
      header: 'Paid via',
      render: (e) => <Badge>{e.method}</Badge>,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (e) => <span className="text-sm font-semibold text-ink-900">{formatMoney(e.amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (e) => <StatusBadge status={e.status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (e) => (
        <div className="flex justify-end gap-1">
          {hasPermission('expense.update') && (
            <Button variant="ghost" size="sm" onClick={() => openEdit(e)} aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {hasPermission('expense.delete') && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => setDeleting(e)} aria-label="Delete">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setModalOpen(true);
  };

  const handleDelete = () => {
    if (!deleting) return;
    setDeleteLoading(true);
    deleteMutation.mutate(deleting._id, { onSettled: () => setDeleteLoading(false) });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Track business spend and reimburseable costs."
        actions={
          hasPermission('expense.create') && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> New expense
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search expenses…" className="w-full max-w-xs" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base w-auto">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => downloadCsv('/expenses/export', { search, status: statusFilter })}>
            Export CSV
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          loading={isLoading}
          emptyIcon={<Wallet className="h-10 w-10" />}
          emptyTitle="No expenses yet"
          emptyDescription="Record expenses to track your net position in reports."
          emptyAction={hasPermission('expense.create') && <Button onClick={openCreate}><Plus className="h-4 w-4" /> New expense</Button>}
          rowKey={(e) => e._id}
        />
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={limit} onChange={setPage} />}
      </Card>

      {(modalOpen || editing) && (
        <ExpenseFormModal expense={editing} onClose={() => { setModalOpen(false); setEditing(null); }} />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete expense"
        message={`Are you sure you want to delete this ${deleting?.category} expense?`}
        confirmLabel="Delete expense"
        danger
      />
    </div>
  );
}

function ExpenseFormModal({ expense, onClose }: { expense: Expense | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: expense
      ? {
          category: expense.category,
          vendor: expense.vendor ?? '',
          amount: expense.amount,
          expenseDate: String(expense.expenseDate).slice(0, 10),
          method: (expense.method as FormValues['method']) || 'other',
          status: (expense.status as FormValues['status']) || 'pending',
          note: expense.note ?? '',
        }
      : EMPTY,
  });

  const save = async (values: FormValues) => {
    try {
      const payload = {
        ...values,
        vendor: values.vendor || undefined,
        note: values.note || undefined,
      };
      if (expense) {
        await api.patch(`/expenses/${expense._id}`, payload);
        toast.success('Expense updated');
      } else {
        await api.post('/expenses', payload);
        toast.success('Expense created');
      }
      await queryClient.invalidateQueries({ queryKey: ['expenses'] });
      onClose();
    } catch (err) {
      toast.error('Could not save expense', getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={expense ? 'Edit expense' : 'New expense'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="expense-form" loading={isSubmitting}>
            {expense ? 'Save changes' : 'Create expense'}
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit(save)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Category *" placeholder="e.g. Software" {...register('category')} error={errors.category?.message} />
          <Input label="Vendor" {...register('vendor')} error={errors.vendor?.message} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Amount *" type="number" step="0.01" min="0.01" {...register('amount')} error={errors.amount?.message} />
          <Input label="Date *" type="date" {...register('expenseDate')} error={errors.expenseDate?.message} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Payment method">
            <select className="input-base" {...register('method')}>
              <option value="card">Card</option>
              <option value="bank">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="Status">
            <select className="input-base" {...register('status')}>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </Field>
        </div>
        <Input label="Note" {...register('note')} error={errors.note?.message} />
      </form>
    </Modal>
  );
}