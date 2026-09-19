import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Download } from 'lucide-react';
import { api, downloadCsv } from '@/lib/api';
import { AuditLog, Paginated } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, EmptyState } from '@/components/ui/Card';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput, useDebouncedValue } from '@/components/ui/SearchInput';
import { useAuth } from '@/store/auth';
import { formatDate, timeAgo, cn } from '@/lib/utils';

const ACTION_TONES: Record<string, string> = {
  create: 'bg-emerald-50 text-emerald-700',
  update: 'bg-blue-50 text-blue-700',
  delete: 'bg-red-50 text-red-600',
  send: 'bg-brand-50 text-brand-700',
  'mark-paid': 'bg-emerald-50 text-emerald-700',
  void: 'bg-red-50 text-red-600',
  convert: 'bg-indigo-50 text-indigo-600',
  approve: 'bg-emerald-50 text-emerald-700',
  login: 'bg-ink-50 text-ink-600',
  logout: 'bg-ink-50 text-ink-600',
  signup: 'bg-ink-50 text-ink-600',
  status: 'bg-amber-50 text-amber-700',
  role: 'bg-amber-50 text-amber-700',
  broadcast: 'bg-amber-50 text-amber-700',
};

export default function AuditPage() {
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, limit, debouncedSearch, action, entity],
    queryFn: async () =>
      (
        await api.get<Paginated<AuditLog>>('/audit', {
          params: {
            page, limit,
            search: debouncedSearch || undefined,
            action: action || undefined,
            entityType: entity || undefined,
          },
        })
      ).data,
    enabled: Boolean(hasPermission('audit.read')),
  });

  useEffect(() => setPage(1), [debouncedSearch, action, entity]);

  const list = data?.data ?? [];

  if (!hasPermission('audit.read')) {
    return <p className="py-16 text-center text-sm text-ink-500">You don't have permission to view the audit log.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        subtitle="Every significant action across the workspace."
        actions={
          <Button variant="secondary" onClick={() => downloadCsv('/audit/export', { search, action, entity })}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search actor, entity…" className="w-full max-w-xs" />
          <select value={action} onChange={(e) => setAction(e.target.value)} className="input-base w-auto">
            <option value="">All actions</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
            <option value="send">Send</option>
            <option value="mark-paid">Mark paid</option>
            <option value="void">Void</option>
            <option value="convert">Convert</option>
            <option value="approve">Approve</option>
            <option value="status">Status change</option>
            <option value="role">Role change</option>
            <option value="login">Login</option>
            <option value="logout">Logout</option>
            <option value="signup">Signup</option>
            <option value="broadcast">Broadcast</option>
          </select>
          <select value={entity} onChange={(e) => setEntity(e.target.value)} className="input-base w-auto">
            <option value="">All types</option>
            {['Client', 'Product', 'Tax', 'Invoice', 'Quote', 'Payment', 'Expense', 'User', 'Role', 'Company', 'Settings'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-ink-400">Loading audit log…</div>
        ) : list.length === 0 ? (
          <EmptyState icon={<ScrollText className="h-10 w-10" />} title="No audit events" description="Search or clear filters to see more." />
        ) : (
          <ul className="divide-y divide-ink-100">
            {list.map((log) => (
              <li key={log._id} className="flex items-start gap-3 px-5 py-4">
                <span
                  className={cn(
                    'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold uppercase',
                    (log.actorName || '—').charAt(0),
                    ACTION_TONES[log.action] ?? 'bg-ink-100 text-ink-600',
                  )}
                >
                  {(log.actorName || '—').slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={ACTION_TONES[log.action] ?? 'bg-ink-100 text-ink-600'}>{log.action}</Badge>
                    <Badge className="bg-ink-50 text-ink-600">{log.entityType}</Badge>
                    <span className="text-sm font-semibold text-ink-900">{log.actorName}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink-600">{log.description}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400">
                    <span title={formatDate(log.createdAt)}>{timeAgo(log.createdAt)}</span>
                    {log.ip && <span>IP {log.ip}</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={limit} onChange={setPage} />}
      </Card>
    </div>
  );
}