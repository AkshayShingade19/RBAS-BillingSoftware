import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Save, Info, Undo2 } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { Role } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, LoadingBlock } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/auth';
import { cn } from '@/lib/utils';

const RESOURCES: { key: string; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'client', label: 'Clients' },
  { key: 'product', label: 'Products' },
  { key: 'tax', label: 'Taxes' },
  { key: 'quote', label: 'Quotes' },
  { key: 'invoice', label: 'Invoices' },
  { key: 'payment', label: 'Payments' },
  { key: 'expense', label: 'Expenses' },
  { key: 'report', label: 'Reports' },
  { key: 'user', label: 'Users' },
  { key: 'role', label: 'Roles' },
  { key: 'notification', label: 'Notifications' },
  { key: 'audit', label: 'Audit' },
  { key: 'settings', label: 'Settings' },
  { key: 'system', label: 'System' },
  { key: 'company', label: 'Company' },
];

const ACTIONS: { key: string; label: string }[] = [
  { key: 'read', label: 'Read' },
  { key: 'create', label: 'Create' },
  { key: 'update', label: 'Update' },
  { key: 'delete', label: 'Delete' },
  { key: 'manage', label: 'Manage' },
];

export default function RolesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);

  const { data: roles, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await api.get<Role[]>('/roles')).data,
    enabled: hasPermission('role.read'),
  });

  useEffect(() => {
    if (roles && roles.length && !selectedKey) {
      const editable = roles.find((r) => r.key !== 'super_admin') ?? roles[0];
      setSelectedKey(editable.key);
      setDraft([...(editable.permissions ?? [])]);
      setDirty(false);
    }
  }, [roles, selectedKey]);

  const role = roles?.find((r) => r.key === selectedKey);

  const save = useMutation({
    mutationFn: async ({ key, permissions }: { key: string; permissions: string[] }) =>
      (await api.patch(`/roles/${key}`, { permissions })).data,
    onSuccess: async () => {
      toast.success('Role updated', 'Changes apply to all users with this role immediately.');
      setDirty(false);
      await queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (err) => toast.error('Could not save role', getErrorMessage(err)),
  });

  if (!hasPermission('role.read')) {
    return <p className="py-16 text-center text-sm text-ink-500">You don't have permission to view roles.</p>;
  }

  const selectRole = (r: Role) => {
    setSelectedKey(r.key);
    setDraft([...(r.permissions ?? [])]);
    setDirty(false);
  };

  const toggle = (perm: string) => {
    setDraft((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));
    setDirty(true);
  };

  const selectAll = (perms: string[], on: boolean) => {
    setDraft((prev) => {
      const without = prev.filter((p) => !perms.includes(p));
      return on ? [...without, ...perms] : without;
    });
    setDirty(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & permissions"
        subtitle="Control what each role can see and do."
        actions={role && hasPermission('role.manage') ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" disabled={!dirty} onClick={() => { setDraft([...(role.permissions ?? [])]); setDirty(false); }}>
              <Undo2 className="h-4 w-4" /> Revert
            </Button>
            <Button onClick={() => role && save.mutate({ key: role.key, permissions: draft })} loading={save.isPending} disabled={!dirty}>
              <Save className="h-4 w-4" /> Save changes
            </Button>
          </div>
        ) : undefined}
      />

      {isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {(roles ?? []).map((r) => {
              const isSys = r.permissions?.includes('*');
              const count = isSys ? 'All' : String(r.permissions?.length ?? 0);
              return (
                <button
                  key={r.key}
                  onClick={() => selectRole(r)}
                  className={cn(
                    'w-full rounded-xl border p-4 text-left transition',
                    selectedKey === r.key
                      ? 'border-brand-300 bg-brand-50/50 shadow-pop'
                      : 'border-ink-100 bg-white hover:border-brand-200',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-ink-900">{r.name}</p>
                    <Badge className="bg-ink-100 text-ink-600">{count}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">{r.description}</p>
                  {isSys && <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-brand-500">System role</p>}
                </button>
              );
            })}
          </div>

          {role ? (
            <Card className="overflow-hidden">
              {role.permissions?.includes('*') ? (
                <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
                  <ShieldCheck className="h-10 w-10 text-brand-400" />
                  <p className="font-semibold text-ink-900">Super Admin</p>
                  <p className="max-w-md text-sm text-ink-500">
                    Super Admin has unrestricted access to every feature, so it cannot be edited here.
                  </p>
                </div>
              ) : (
                (!hasPermission('role.manage')
                  ? renderMatrix(draft, true, selectAll, null)
                  : renderMatrix(draft, false, selectAll, toggle)
                )
              )}
            </Card>
          ) : (
            <EmptyRoles />
          )}
        </div>
      )}
    </div>
  );
}

function renderMatrix(
  permissions: string[],
  locked: boolean,
  selectAll: (perms: string[], on: boolean) => void,
  toggle: ((perm: string) => void) | null,
) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-100 bg-ink-50/50 text-xs uppercase tracking-wide text-ink-400">
            <th className="py-3 pl-5 pr-4 text-left font-semibold">Feature</th>
            {ACTIONS.map((a) => (
              <th key={a.key} className="w-24 py-3 px-2 text-center font-semibold">{a.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {RESOURCES.map((resource) => {
            const perms = ACTIONS.map((a) => `${resource.key}.${a.key}`);
            const full = perms.every((p) => permissions.includes(p));
            return (
              <tr key={resource.key} className="hover:bg-ink-50/40">
                <td className="py-2 pl-5 pr-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-ink-800">{resource.label}</span>
                    {!locked && (
                      <button
                        onClick={() => selectAll(perms, !full)}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        {full ? 'Clear' : 'Select all'}
                      </button>
                    )}
                  </div>
                </td>
                {perms.map((perm) => {
                  const on = permissions.includes(perm);
                  return (
                    <td key={perm} className="py-2 px-2 text-center">
                      {toggle ? (
                        <button
                          onClick={() => toggle(perm)}
                          aria-label={perm}
                          className={cn(
                            'mx-auto flex h-6 w-6 items-center justify-center rounded-md border transition',
                            on ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 bg-white text-transparent hover:border-brand-300',
                          )}
                        >
                          <CheckIcon />
                        </button>
                      ) : (
                        <span
                          className={cn(
                            'mx-auto flex h-6 w-6 items-center justify-center rounded-md border',
                            on ? 'border-brand-200 bg-brand-50 text-emerald-600' : 'border-ink-100 bg-ink-50 text-transparent',
                          )}
                        >
                          <CheckIcon />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {locked && (
        <div className="flex items-center gap-2 border-t border-ink-100 bg-amber-50/50 px-5 py-3 text-xs text-amber-700">
          <Info className="h-4 w-4 shrink-0" />
          Only users with role.manage can edit permissions. This is a read-only view.
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}

function EmptyRoles() {
  return (
    <Card className="p-16 text-center">
      <p className="text-sm text-ink-400">No roles to display.</p>
    </Card>
  );
}