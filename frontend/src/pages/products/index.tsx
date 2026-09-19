import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Package } from 'lucide-react';
import { api, getErrorMessage, downloadCsv } from '@/lib/api';
import { Product, Tax, Paginated } from '@/lib/types';
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
import { formatMoney } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  sku: z.string().max(100).optional().or(z.literal('')),
  description: z.string().max(1000).optional().or(z.literal('')),
  category: z.string().max(100).optional().or(z.literal('')),
  unitPrice: z.coerce.number({ invalid_type_error: 'Price is required' }).min(0, 'Price cannot be negative'),
  taxId: z.string().optional().or(z.literal('')),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [categoryFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, limit, debouncedSearch, categoryFilter],
    queryFn: async () =>
      (
        await api.get<Paginated<Product>>('/products', {
          params: { page, limit, search: debouncedSearch || undefined, category: categoryFilter || undefined },
        })
      ).data,
  });

  useEffect(() => setPage(1), [debouncedSearch, categoryFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/products/${id}`),
    onSuccess: async () => {
      toast.success('Product deleted');
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err) => toast.error('Could not delete product', getErrorMessage(err)),
  });

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (p) => (
        <div>
          <p className="text-sm font-semibold text-ink-900">{p.name}</p>
          <p className="text-xs text-ink-400">{p.sku ? `SKU: ${p.sku}` : p.category || '—'}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (p) => <span className="text-sm text-ink-600">{p.category || '—'}</span>,
    },
    {
      key: 'price',
      header: 'Unit price',
      render: (p) => <span className="text-sm font-medium text-ink-900">{formatMoney(p.unitPrice)}</span>,
    },
    {
      key: 'tax',
      header: 'Tax',
      render: (p) => (p.tax ? <Badge>{p.tax.name} ({p.tax.rate}%)</Badge> : <span className="text-xs text-ink-400">—</span>),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge status={p.isActive ? 'active' : 'inactive'} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (p) => (
        <div className="flex justify-end gap-1">
          {hasPermission('product.update') && (
            <Button variant="ghost" size="sm" onClick={() => openEdit(p)} aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {hasPermission('product.delete') && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => setDeleting(p)} aria-label="Delete">
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

  const openEdit = (p: Product) => {
    setEditing(p);
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
        title="Products"
        subtitle="Catalog of billable items and services."
        actions={
          hasPermission('product.create') && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> New product
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search products…" className="w-full max-w-xs" />
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => downloadCsv('/products/export', { search, category: categoryFilter })}>
            Export CSV
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          loading={isLoading}
          emptyIcon={<Package className="h-10 w-10" />}
          emptyTitle="No products yet"
          emptyDescription="Add products to use them on invoices and quotes."
          emptyAction={hasPermission('product.create') && <Button onClick={openCreate}><Plus className="h-4 w-4" /> New product</Button>}
          rowKey={(p) => p._id}
        />
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={limit} onChange={setPage} />}
      </Card>

      {(modalOpen || editing) && (
        <ProductFormModal
          product={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete product"
        message={`Are you sure you want to delete "${deleting?.name}"?`}
        confirmLabel="Delete product"
        danger
      />
    </div>
  );
}

function ProductFormModal({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: taxes } = useQuery({
    queryKey: ['taxes'],
    queryFn: async () => (await api.get<Paginated<Tax>>('/taxes', { params: { limit: 100 } })).data.data,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: product
      ? {
          name: product.name,
          sku: product.sku ?? '',
          description: product.description ?? '',
          category: product.category ?? '',
          unitPrice: product.unitPrice,
          taxId: product.taxId ?? '',
          isActive: product.isActive,
        }
      : { name: '', sku: '', description: '', category: '', unitPrice: 0, taxId: '', isActive: true },
  });

  const save = async (values: FormValues) => {
    try {
      const payload = {
        name: values.name,
        sku: values.sku || undefined,
        description: values.description || undefined,
        category: values.category || undefined,
        unitPrice: values.unitPrice,
        taxId: values.taxId || null,
        isActive: values.isActive,
      };
      if (product) {
        await api.patch(`/products/${product._id}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/products', payload);
        toast.success('Product created');
      }
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    } catch (err) {
      toast.error('Could not save product', getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={product ? 'Edit product' : 'New product'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="product-form" loading={isSubmitting}>
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit(save)} className="space-y-4">
        <Input label="Name *" {...register('name')} error={errors.name?.message} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="SKU" {...register('sku')} error={errors.sku?.message} />
          <Input label="Category" {...register('category')} error={errors.category?.message} />
        </div>
        <Input label="Description" {...register('description')} error={errors.description?.message} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Unit price *" type="number" step="0.01" min="0" {...register('unitPrice')} error={errors.unitPrice?.message} />
          <Field label="Default tax">
            <select className="input-base" {...register('taxId')}>
              <option value="">No tax</option>
              {taxes?.filter((t) => t.isActive).map((t) => (
                <option key={t._id} value={t._id}>{t.name} ({t.rate}%)</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Active">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-600" {...register('isActive')} />
            Available for use on new invoices
          </label>
        </Field>
      </form>
    </Modal>
  );
}