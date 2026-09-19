import { useState, useEffect } from 'react';
import { ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Eye, Users, Mail, Phone, Globe, Building2 } from 'lucide-react';
import { api, getErrorMessage, downloadCsv } from '@/lib/api';
import { Client, Paginated } from '@/lib/types';
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
import { formatDate } from '@/lib/utils';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  website: z.string().max(200).optional().or(z.literal('')),
  taxId: z.string().max(100).optional().or(z.literal('')),
  address: z.object({
    line1: z.string().optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    state: z.string().optional().or(z.literal('')),
    zip: z.string().optional().or(z.literal('')),
    country: z.string().optional().or(z.literal('')),
  }),
  status: z.enum(['active', 'inactive']),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  name: '',
  email: '',
  phone: '',
  website: '',
  taxId: '',
  address: { line1: '', city: '', state: '', zip: '', country: '' },
  status: 'active',
};

export default function ClientsPage() {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', page, limit, debouncedSearch, statusFilter],
    queryFn: async () =>
      (
        await api.get<Paginated<Client>>('/clients', {
          params: { page, limit, search: debouncedSearch || undefined, status: statusFilter || undefined },
        })
      ).data,
  });

  const { data: detail } = useQuery({
    queryKey: ['client-detail', paramId],
    queryFn: async () => (await api.get(`/clients/${paramId}`)).data,
    enabled: Boolean(paramId),
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/clients/${id}`),
    onSuccess: async () => {
      toast.success('Client deleted');
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
    onError: (err) => toast.error('Could not delete client', getErrorMessage(err)),
  });

  const columns: Column<Client>[] = [
    {
      key: 'name',
      header: 'Client',
      render: (c) => (
        <button onClick={() => navigate(`/clients/${c._id}`)} className="flex items-center gap-3 text-left">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {c.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink-900 hover:text-brand-700">{c.name}</span>
            {c.email && <span className="block text-xs text-ink-400">{c.email}</span>}
          </span>
        </button>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (c) => (
        <div className="text-sm text-ink-600">
          {c.phone && <p>{c.phone}</p>}
          {c.website && <p className="text-xs text-ink-400">{c.website}</p>}
          {!c.phone && !c.website && <span className="text-ink-400">—</span>}
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Location',
      render: (c) => (
        <span className="text-sm text-ink-600">
          {c.address?.city ? `${c.address.city}${c.address.country ? `, ${c.address.country}` : ''}` : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: 'created',
      header: 'Created',
      render: (c) => <span className="text-sm text-ink-500">{formatDate(c.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/clients/${c._id}`)} aria-label="View">
            <Eye className="h-4 w-4" />
          </Button>
          {hasPermission('client.update') && (
            <Button variant="ghost" size="sm" onClick={() => openEdit(c)} aria-label="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {hasPermission('client.delete') && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => setDeleting(c)} aria-label="Delete">
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

  const openEdit = (client: Client) => {
    setEditing(client);
    setModalOpen(true);
  };

  const handleDelete = () => {
    if (!deleting) return;
    setDeleteLoading(true);
    deleteMutation.mutate(deleting._id, {
      onSettled: () => setDeleteLoading(false),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="People and businesses you bill."
        actions={
          hasPermission('client.create') && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> New client
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search clients…" className="w-full max-w-xs" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base w-auto">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => downloadCsv('/clients/export', { search, status: statusFilter })}>
            Export CSV
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          loading={isLoading}
          emptyIcon={<Users className="h-10 w-10" />}
          emptyTitle="No clients yet"
          emptyDescription="Create your first client to start billing."
          emptyAction={hasPermission('client.create') && <Button onClick={openCreate}><Plus className="h-4 w-4" /> New client</Button>}
          rowKey={(c) => c._id}
        />
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={limit} onChange={setPage} />}
      </Card>

      {paramId && detail && <ClientDetailPane detail={detail} onClose={() => navigate('/clients')} onEdit={() => navigate(`/clients/${paramId}?edit=1`)} />}

      {(modalOpen || editing) && (
        <ClientFormModal
          client={editing}
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
        title="Delete client"
        message={`Are you sure you want to delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete client"
        danger
      />
    </div>
  );
}

function ClientDetailPane({ detail, onClose, onEdit }: { detail: any; onClose: () => void; onEdit: () => void }) {
  const c = detail?.client ?? detail;
  const stats = detail?.stats;
  return (
    <Modal open onClose={onClose} title="Client details" size="lg">
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
              {c?.name?.split(/\s+/).filter(Boolean).slice(0, 2).map((p: string) => p[0]?.toUpperCase()).join('')}
            </span>
            <div>
              <h3 className="text-lg font-semibold text-ink-900">{c?.name}</h3>
              <div className="mt-1 flex gap-2">
                <StatusBadge status={c?.status} />
                <Badge>{c?.taxId ? `Tax ID: ${c.taxId}` : 'No tax ID'}</Badge>
              </div>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoTile icon={<Mail className="h-4 w-4" />} label="Email" value={c?.email || '—'} />
          <InfoTile icon={<Phone className="h-4 w-4" />} label="Phone" value={c?.phone || '—'} />
          <InfoTile icon={<Globe className="h-4 w-4" />} label="Website" value={c?.website || '—'} />
          <InfoTile icon={<Building2 className="h-4 w-4" />} label="Location" value={formatAddress(c?.address)} />
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-3 border-t border-ink-100 pt-4">
            <SummaryTile label="Invoices" value={stats.invoiceCount} />
            <SummaryTile label="Invoiced" value={currency(stats.totalInvoiced)} />
            <SummaryTile label="Outstanding" value={currency(stats.balance)} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function InfoTile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-100 bg-ink-50/50 p-3">
      <p className="flex items-center gap-1.5 text-xs text-ink-400">
        {icon} {label}
      </p>
      <p className="mt-1 text-sm font-medium text-ink-800">{value}</p>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-ink-100 p-3 text-center">
      <p className="text-base font-bold text-ink-900">{typeof value === 'number' ? value : value}</p>
      <p className="text-xs text-ink-400">{label}</p>
    </div>
  );
}

function formatAddress(a?: { line1?: string; city?: string; state?: string; zip?: string; country?: string }) {
  if (!a) return '—';
  return [a.city, a.country].filter(Boolean).join(', ') || a.line1 || '—';
}

function currency(n?: number) {
  return n === undefined || n === null ? '—' : `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function ClientFormModal({ client, onClose }: { client: Client | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: client
      ? {
          name: client.name,
          email: client.email ?? '',
          phone: client.phone ?? '',
          website: client.website ?? '',
          taxId: client.taxId ?? '',
          address: { ...emptyValues.address, ...(client.address ?? {}) },
          status: client.status,
        }
      : emptyValues,
  });

  const save = async (values: FormValues) => {
    try {
      const { address, ...rest } = values;
      const payload = {
        ...rest,
        email: rest.email || undefined,
        phone: rest.phone || undefined,
        website: rest.website || undefined,
        taxId: rest.taxId || undefined,
        address: {
          line1: address.line1 || undefined,
          city: address.city || undefined,
          state: address.state || undefined,
          zip: address.zip || undefined,
          country: address.country || undefined,
        },
      };
      if (client) {
        await api.patch(`/clients/${client._id}`, payload);
        toast.success('Client updated');
      } else {
        await api.post('/clients', payload);
        toast.success('Client created');
      }
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    } catch (err) {
      toast.error('Could not save client', getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={client ? 'Edit client' : 'New client'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="client-form" loading={isSubmitting}>
            {client ? 'Save changes' : 'Create client'}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit(save)} className="space-y-4">
        <Input label="Name *" {...register('name')} error={errors.name?.message} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" {...register('email')} error={errors.email?.message} />
          <Input label="Phone" {...register('phone')} error={errors.phone?.message} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Website" {...register('website')} error={errors.website?.message} />
          <Input label="Tax ID" {...register('taxId')} error={errors.taxId?.message} />
        </div>
        <div className="rounded-lg border border-ink-100 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">Address</p>
          <div className="space-y-3">
            <Input label="Line 1" {...register('address.line1')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="City" {...register('address.city')} />
              <Input label="State" {...register('address.state')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="ZIP / Postal" {...register('address.zip')} />
              <Input label="Country" {...register('address.country')} />
            </div>
          </div>
        </div>
        <Field label="Status">
          <select className="input-base" {...register('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
      </form>
    </Modal>
  );
}