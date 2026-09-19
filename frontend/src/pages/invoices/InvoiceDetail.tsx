import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ArrowLeft, Pencil, Send, CheckCircle2, Ban, Printer, Trash2,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { Invoice } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Card, LoadingBlock } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/auth';
import { DocumentView } from '@/components/DocumentView';
import { formatMoney } from '@/lib/utils';
import { Input } from '@/components/ui/Input';

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();

  const [voidOpen, setVoidOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoices', id],
    queryFn: async () => (await api.get<Invoice>(`/invoices/${id}`)).data,
    enabled: Boolean(id),
  });

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get<any>('/company')).data,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['invoices'] });
  };

  const runAction = async (fn: () => Promise<unknown>, message: string) => {
    setActionLoading(true);
    try {
      await fn();
      toast.success(message);
      await invalidate();
    } catch (err) {
      toast.error(message.replace('ed', 'ing') + ' failed', getErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  };

  const voidMutation = useMutation({
    mutationFn: async () => api.post(`/invoices/${id}/void`, { reason: voidReason || undefined }),
    onSuccess: async () => {
      toast.success('Invoice voided');
      setVoidOpen(false);
      await invalidate();
    },
    onError: (err) => toast.error('Could not void invoice', getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => api.delete(`/invoices/${id}`),
    onSuccess: async () => {
      toast.success('Invoice deleted');
      navigate('/invoices');
    },
    onError: (err) => toast.error('Could not delete invoice', getErrorMessage(err)),
  });

  if (isLoading) return <LoadingBlock />;
  if (!invoice) return <p className="text-center py-16 text-sm text-ink-400">Invoice not found.</p>;

  const editable = invoice.status === 'draft';
  const statusActions: JSX.Element | null =
    invoice.status === 'draft' ? (
      <>
        {hasPermission('invoice.update') && (
          <Button onClick={() => runAction(() => api.post(`/invoices/${id}/send`), 'Invoice sent')} loading={actionLoading}>
            <Send className="h-4 w-4" /> Send invoice
          </Button>
        )}
      </>
    ) : invoice.status === 'sent' || invoice.status === 'partial' || invoice.status === 'overdue' ? (
      <>
        {hasPermission('invoice.update') && (
          <Button onClick={() => runAction(() => api.post(`/invoices/${id}/mark-paid`), 'Invoice marked paid')} loading={actionLoading}>
            <CheckCircle2 className="h-4 w-4" /> Mark as paid
          </Button>
        )}
      </>
    ) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
          <ArrowLeft className="h-4 w-4" /> All invoices
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {statusActions}
          {editable && hasPermission('invoice.update') && (
            <Button variant="secondary" onClick={() => navigate(`/invoices/${id}/edit`)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
          )}
          {hasPermission('invoice.update') && invoice.status !== 'void' && (
            <Button variant="secondary" onClick={() => setVoidOpen(true)}>
              <Ban className="h-4 w-4" /> Void
            </Button>
          )}
          {editable && hasPermission('invoice.delete') && (
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <Card className="p-6 sm:p-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-ink-900">Invoice preview</h1>
          <p className="text-sm text-ink-500">
            Balance:{' '}
            <span className="font-semibold text-ink-900">{formatMoney(invoice.balanceDue, invoice.currency)}</span>
          </p>
        </div>
        <DocumentView doc={invoice} company={company} kind="invoice" />
      </Card>

      <ConfirmDialog
        open={voidOpen}
        onClose={() => setVoidOpen(false)}
        onConfirm={() => voidMutation.mutate()}
        loading={voidMutation.isPending}
        title="Void invoice"
        message="Voiding keeps the invoice number but sets its status to void. Continue?"
        confirmLabel="Void invoice"
        danger
      >
        <div className="mt-3">
          <Input
            label="Reason (optional)"
            placeholder="e.g. billing error, cancelled project"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="Delete invoice"
        message="Only draft invoices can be deleted. This cannot be undone."
        confirmLabel="Delete invoice"
        danger
      />
    </div>
  );
}