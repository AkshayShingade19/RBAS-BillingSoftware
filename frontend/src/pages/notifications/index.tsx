import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck, SendHorizontal, Megaphone } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { AppNotification, Paginated } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Card, EmptyState, LoadingBlock } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/auth';
import { timeAgo } from '@/lib/utils';

const NOTIFICATION_TYPE_TONE: Record<string, string> = {
  invoice_sent: 'bg-blue-50 text-blue-600',
  payment_received: 'bg-emerald-50 text-emerald-600',
  quote_accepted: 'bg-brand-50 text-brand-600',
  overdue: 'bg-red-50 text-red-500',
  welcome: 'bg-ink-50 text-ink-600',
  broadcast: 'bg-amber-50 text-amber-600',
};

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', page, limit],
    queryFn: async () => (await api.get<Paginated<AppNotification>>('/notifications', { params: { page, limit } })).data,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.post('/notifications/read-all'),
    onSuccess: async () => {
      toast.success('All notifications marked as read');
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] });
    },
    onError: (err) => toast.error('Could not mark as read', getErrorMessage(err)),
  });

  const list = data?.data ?? [];
  const hasUnread = list.some((n) => !n.readAt);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Stay on top of invoice activity."
        actions={
          <>
            {hasUnread && (
              <Button variant="secondary" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
                <CheckCheck className="h-4 w-4" /> Mark all read
              </Button>
            )}
            {hasPermission('notification.manage') && (
              <Button onClick={() => setBroadcastOpen(true)}>
                <Megaphone className="h-4 w-4" /> Broadcast
              </Button>
            )}
          </>
        }
      />

      <Card>
        {isLoading ? (
          <LoadingBlock label="Loading notifications…" />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<BellOff className="h-10 w-10" />}
            title="All caught up"
            description="You have no notifications yet. Invoice activity will appear here."
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {list.map((n) => (
              <li key={n._id}>
                <button
                  onClick={() => {
                    if (!n.readAt) markRead.mutate(n._id);
                  }}
                  className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-ink-50/60 ${
                    n.readAt ? '' : ''
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      NOTIFICATION_TYPE_TONE[n.type] ?? 'bg-ink-100 text-ink-600'
                    }`}
                  >
                    <Bell className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink-900">{n.title}</p>
                      {!n.readAt && <Badge className="bg-brand-600 text-white">New</Badge>}
                    </div>
                    {n.body && <p className="mt-0.5 text-sm text-ink-500">{n.body}</p>}
                    <p className="mt-1 text-xs text-ink-400">{timeAgo(n.createdAt)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {data && <Pagination page={page} totalPages={data.totalPages} total={data.total} limit={limit} onChange={setPage} />}
      </Card>

      {broadcastOpen && (
        <BroadcastModal
          onClose={() => setBroadcastOpen(false)}
        />
      )}
    </div>
  );
}

function BroadcastModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim()) {
      toast.info('Add a title', 'The broadcast needs a title.');
      return;
    }
    setSending(true);
    try {
      await api.post('/notifications/broadcast', { title: title.trim(), body: body.trim() || undefined });
      toast.success('Broadcast sent', 'All active users will see this.');
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      onClose();
    } catch (err) {
      toast.error('Could not send broadcast', getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Broadcast notification"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={send} loading={sending}>
            <SendHorizontal className="h-4 w-4" /> Send to everyone
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Title *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Billing freeze this weekend" />
        <Input label="Message" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Optional details for all users." />
      </div>
    </Modal>
  );
}