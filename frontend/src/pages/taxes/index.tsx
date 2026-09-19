import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Percent } from 'lucide-react';
import { api, getErrorMessage, downloadCsv } from '@/lib/api';
import { Tax, Paginated } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/SearchInput';
import { DataTable, Column } from '@/components/ui/Table';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/auth';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  rate: z.coerce.number({ invalid_type_error: 'Rate is required' }).min(0, 'Rate cannot be negative').max(100, 'Rate cannot exceed 100'),
  isActive: z.boolean(),
  isDefault: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function TaxesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tax | null>(null);
  const [deleting, setDeleting] = useState<Tax | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['taxes', page, limit, debouncedSearch],
    queryFn: async () =>
      (await api.get<Paginated<Tax>>('/taxes', { params: { page, limit, search: debouncedSearch || undefined } }))
        .data,
  });

  useEffect(() => setPage(1), [debouncedSearch]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/taxes/${id}`),
    onSuccess: async () => {
      toast.success('Tax deleted');
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ['taxes'] });
    },
    onError: (err) => toast.error('Could not delete tax', getErrorMessage(err)),
  });

  const columns: Column<Tax>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (t) => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-900">{t.name}</span>
          {t.isDefault && <Badge className="bg-brand-50 text-brand-700">Default</Badge>}
        </div>
      ),
    },
    {
      key: 'rate',
      header: 'Rate',
      render: (t) => <span className="text-sm font-medium text-ink-900">{t.rate}%</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) => <StatusBadge status={t.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (t) => (
        <div className="flex justify-end gap-1">
          {hasPermission('tax.update') && (
            <Button variant="ghost" size="sm" onClick={() => openEdit(t)} aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {hasPermission('tax.delete') && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => setDeleting(t)} aria-label="Delete">
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

  const openEdit = (t: Tax) => {
    setEditing(t);
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
        title="Taxes"
        subtitle="Sales tax rates used on invoices and quotes."
        actions={
          hasPermission('tax.create') && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> New tax
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search taxes…" className="w-full max-w-xs" />
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => downloadCsv('/taxes/export', { search })}>
            Export CSV
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          loading={isLoading}
          emptyIcon={<Percent className="h-10 w-10" />}
          emptyTitle="No taxes defined"
          emptyDescription="Add tax rates to apply them to line items."
          emptyAction={hasPermission('tax.create') && <Button onClick={openCreate}><Plus className="h-4 w-4" /> New tax</Button>}
          rowKey={(t) => t._id}
        />
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={limit} onChange={setPage} />}
      </Card>

      {(modalOpen || editing) && (
        <TaxFormModal tax={editing} onClose={() => { setModalOpen(false); setEditing(null); }} />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete tax"
        message={`Are you sure you want to delete "${deleting?.name}"?`}
        confirmLabel="Delete tax"
        danger
      />
    </div>
  );
}

function TaxFormModal({ tax, onClose }: { tax: Tax | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: tax
      ? { name: tax.name, rate: tax.rate, isActive: tax.isActive, isDefault: tax.isDefault }
      : { name: '', rate: 0, isActive: true, isDefault: false },
  });

  const save = async (values: FormValues) => {
    try {
      if (tax) {
        await api.patch(`/taxes/${tax._id}`, values);
        toast.success('Tax updated');
      } else {
        await api.post('/taxes', values);
        toast.success('Tax created');
      }
      await queryClient.invalidateQueries({ queryKey: ['taxes'] });
      onClose();
    } catch (err) {
      toast.error('Could not save tax', getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={tax ? 'Edit tax' : 'New tax'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="tax-form" loading={isSubmitting}>
            {tax ? 'Save changes' : 'Create tax'}
          </Button>
        </>
      }
    >
      <form id="tax-form" onSubmit={handleSubmit(save)} className="space-y-4">
        <Input label="Name *" placeholder="e.g. VAT" {...register('name')} error={errors.name?.message} />
        <Input label="Rate (%) *" type="number" step="0.01" min="0" max="100" {...register('rate')} error={errors.rate?.message} />
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-600" {...register('isActive')} />
            Active
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-600" {...register('isDefault')} />
            Default tax for new line items
          </label>
        </div>
      </form>
    </Modal>
  );
}