import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Pencil, Send, CheckCircle2, XCircle, Trash2, Printer, FilePlus2,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { Quote } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Card, LoadingBlock } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/auth';
import { DocumentView } from '@/components/DocumentView';

export default function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quotes', id],
    queryFn: async () => (await api.get<Quote>(`/quotes/${id}`)).data,
    enabled: Boolean(id),
  });

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get<any>('/company')).data,
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['quotes'] });
  };

  const statusMutation = useMutation({
    mutationFn: async (status: 'sent' | 'accepted' | 'rejected') => api.post(`/quotes/${id}/status`, { status }),
    onSuccess: async () => {
      toast.success('Quote status updated');
      await invalidate();
    },
    onError: (err) => toast.error('Could not update quote', getErrorMessage(err)),
  });

  const convertMutation = useMutation({
    mutationFn: async () => (await api.post<{ invoiceId: string }>(`/quotes/${id}/convert`)).data,
    onSuccess: async (data) => {
      toast.success('Quote converted');
      setConvertOpen(false);
      await invalidate();
      navigate(`/invoices/${data.invoiceId}`);
    },
    onError: (err) => toast.error('Could not convert quote', getErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => api.delete(`/quotes/${id}`),
    onSuccess: async () => {
      toast.success('Quote deleted');
      navigate('/quotes');
    },
    onError: (err) => toast.error('Could not delete quote', getErrorMessage(err)),
  });

  if (isLoading) return <LoadingBlock />;
  if (!quote) return <p className="py-16 text-center text-sm text-ink-400">Quote not found.</p>;

  const editable = quote.status === 'draft';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/quotes')}>
          <ArrowLeft className="h-4 w-4" /> All quotes
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {editable && hasPermission('quote.update') && (
            <>
              <Button onClick={() => statusMutation.mutate('sent')} loading={statusMutation.isPending}>
                <Send className="h-4 w-4" /> Send quote
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/quotes/${id}/edit`)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </>
          )}
          {quote.status === 'sent' && hasPermission('quote.update') && (
            <>
              <Button variant="secondary" onClick={() => statusMutation.mutate('accepted')} loading={statusMutation.isPending}>
                <CheckCircle2 className="h-4 w-4" /> Accept
              </Button>
              <Button variant="secondary" onClick={() => statusMutation.mutate('rejected')} loading={statusMutation.isPending}>
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            </>
          )}
          {(quote.status === 'accepted' || quote.status === 'sent') && hasPermission('invoice.create') && (
            <Button onClick={() => setConvertOpen(true)}>
              <FilePlus2 className="h-4 w-4" /> Convert to invoice
            </Button>
          )}
          {editable && hasPermission('quote.delete') && (
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
          <h1 className="text-xl font-bold text-ink-900">Quote preview</h1>
          {quote.convertedToInvoiceId && (
            <Button variant="secondary" size="sm" onClick={() => navigate(`/invoices/${quote.convertedToInvoiceId}`)}>
              View converted invoice
            </Button>
          )}
        </div>
        <DocumentView doc={quote} company={company} kind="quote" />
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
        title="Delete quote"
        message="Only draft quotes can be deleted. This cannot be undone."
        confirmLabel="Delete quote"
        danger
      />

      <ConfirmDialog
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConfirm={() => convertMutation.mutate()}
        loading={convertMutation.isPending}
        title="Convert to invoice"
        message={`This creates an invoice from ${quote.quoteNumber} and marks the quote as converted. Continue?`}
        confirmLabel="Convert to invoice"
      />
    </div>
  );
}