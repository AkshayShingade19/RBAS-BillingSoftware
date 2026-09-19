import { useState, useEffect } from 'react';
import { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, ShieldCheck, RotateCcw, Ban, CheckCircle2, UserX } from 'lucide-react';
import { api, getErrorMessage, downloadCsv } from '@/lib/api';
import { User, Role, Paginated } from '@/lib/types';
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
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must include uppercase, lowercase and a number'),
  role: z.string().min(1, 'Select a role'),
});

type FormValues = z.infer<typeof schema>;

export default function UsersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission, user: currentUser } = useAuth();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, limit, debouncedSearch, roleFilter, statusFilter],
    queryFn: async () =>
      (
        await api.get<Paginated<User>>('/users', {
          params: {
            page, limit,
            search: debouncedSearch || undefined,
            role: roleFilter || undefined,
            status: statusFilter || undefined,
          },
        })
      ).data,
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<Role[]>('/roles')).data,
  });

  useEffect(() => setPage(1), [debouncedSearch, roleFilter, statusFilter]);

  const restart = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['users'] }),
      queryClient.invalidateQueries({ queryKey: ['roles'] }),
    ]);
  };

  const changeRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => api.patch(`/users/${id}/role`, { role }),
    onSuccess: async () => {
      toast.success('Role updated');
      await restart();
      await invalidateMe();
    },
    onError: (err) => toast.error('Could not change role', getErrorMessage(err)),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => api.patch(`/users/${id}/status`, { status }),
    onSuccess: async () => {
      toast.success('User status updated');
      await restart();
    },
    onError: (err) => toast.error('Could not update status', getErrorMessage(err)),
  });

  const invalidateMe = async () => {
    await queryClient.invalidateQueries({ queryKey: ['me'] });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/users/${id}`),
    onSuccess: async () => {
      toast.success('User deleted');
      setDeleting(null);
      await restart();
    },
    onError: (err) => toast.error('Could not delete user', getErrorMessage(err)),
  });

  const isCurrent = (u: User) => u.id === currentUser?.id;

  const columns: Column<User>[] = [
    {
      key: 'user',
      header: 'User',
      render: (u) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {u.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')}
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-900">
              {u.name}
              {isCurrent(u) && <Badge className="ml-2 bg-brand-50 text-brand-700">You</Badge>}
            </p>
            <p className="text-xs text-ink-400">{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <FieldInline>
          <select
            className="input-base"
            value={u.role}
            disabled={hasPermission('user.manage') && !isCurrent(u) ? false : true}
            onChange={(e) => {
              if (e.target.value !== u.role) changeRole.mutate({ id: u.id, role: e.target.value });
            }}
          >
            {(roles ?? []).map((r) => (
              <option key={r.key} value={r.key}>{r.name}</option>
            ))}
          </select>
        </FieldInline>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => <StatusBadge status={u.status} />,
    },
    {
      key: 'verified',
      header: 'Email',
      render: (u) =>
        u.emailVerified ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Verified</span>
        ) : (
          <span className="text-xs text-amber-600">Unverified</span>
        ),
    },
    {
      key: 'lastLogin',
      header: 'Last login',
      render: (u) => <span className="text-sm text-ink-500">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (u) => {
        if (isCurrent(u) || !hasPermission('user.manage')) return <span className="text-xs text-ink-300">—</span>;
        const isActive = u.status === 'active';
        return (
          <div className="flex justify-end gap-1">
            {u.status === 'suspended' && (
              <Button variant="ghost" size="sm" title="Activate" onClick={() => changeStatus.mutate({ id: u.id, status: 'active' })}>
                <RotateCcw className="h-4 w-4 text-emerald-600" />
              </Button>
            )}
            {u.status === 'pending' && (
              <Button variant="ghost" size="sm" title="Approve" onClick={() => changeStatus.mutate({ id: u.id, status: 'active' })}>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </Button>
            )}
            {isActive && (
              <Button variant="ghost" size="sm" title="Suspend" onClick={() => changeStatus.mutate({ id: u.id, status: 'suspended' })}>
                <Ban className="h-4 w-4 text-amber-600" />
              </Button>
            )}
            {hasPermission('user.delete') && (
              <Button variant="ghost" size="sm" title="Delete" className="text-red-500 hover:bg-red-50" onClick={() => setDeleting(u)}>
                <UserX className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle="Manage who can access this workspace."
        actions={
          hasPermission('user.create') && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" /> Invite user
            </Button>
          )
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search users…" className="w-full max-w-xs" />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="input-base w-auto">
            <option value="">All roles</option>
            {(roles ?? []).map((r) => (
              <option key={r.key} value={r.key}>{r.name}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-base w-auto">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => downloadCsv('/users/export', { search, role: roleFilter, status: statusFilter })}>
            Export CSV
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={data?.data ?? []}
          loading={isLoading}
          emptyIcon={<ShieldCheck className="h-10 w-10" />}
          emptyTitle="No users found"
          emptyDescription="Invite team members to collaborate on billing."
          rowKey={(u) => u.id}
        />
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={limit} onChange={setPage} />}
      </Card>

      {modalOpen && <UserCreateModal roles={roles ?? []} onClose={() => setModalOpen(false)} />}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          setDeleteLoading(true);
          deleteMutation.mutate(deleting.id, { onSettled: () => setDeleteLoading(false) });
        }}
        loading={deleteLoading}
        title="Delete user"
        message={`Are you sure you want to permanently remove ${deleting?.name} (${deleting?.email})?`}
        confirmLabel="Delete user"
        danger
      />
    </div>
  );
}

function FieldInline({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function UserCreateModal({ roles, onClose }: { roles: Role[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', role: 'accountant' },
  });

  const save = async (values: FormValues) => {
    try {
      await api.post('/users', values);
      toast.success('User created', 'They can now sign in.');
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    } catch (err) {
      toast.error('Could not create user', getErrorMessage(err));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Invite a user"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="user-create-form" loading={isSubmitting}>Create user</Button>
        </>
      }
    >
      <form id="user-create-form" onSubmit={handleSubmit(save)} className="space-y-4">
        <Input label="Full name *" {...register('name')} error={errors.name?.message} />
        <Input label="Email *" type="email" {...register('email')} error={errors.email?.message} />
        <Input
          label="Temporary password *"
          type="password"
          placeholder="At least 8 chars, A-Z, a-z, 0-9"
          {...register('password')}
          error={errors.password?.message}
          autoComplete="new-password"
        />
        <Field label="Role">
          <select className="input-base" {...register('role')}>
            {roles.map((r) => (
              <option key={r.key} value={r.key}>{r.name}</option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  );
}