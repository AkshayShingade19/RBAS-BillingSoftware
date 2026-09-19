import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, getErrorMessage } from '@/lib/api';
import { Invoice, Paginated } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { formatMoney } from '@/lib/utils';

const PAYABLE_STATUSES = ['sent', 'partial', 'overdue'];

const schema = z.object({
  invoiceId: z.string().min(1, 'Select an invoice'),
  amount: z.coerce.number({ invalid_type_error: 'Amount is required' }).min(0.01, 'Amount must be at least 0.01'),
  method: z.enum(['card', 'bank', 'cash', 'other']),
  reference: z.string().max(200).optional().or(z.literal('')),
  paidAt: z.string().min(1, 'Date is required'),
  note: z.string().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function RecordPaymentForm({ onSuccess, onCancel, submitLabel = 'Record payment' }: {
  onSuccess: () => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: payableInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', 'payable'],
    queryFn: async () => {
      const pages = await Promise.all(
        PAYABLE_STATUSES.map(async (status) =>
          (await api.get<Paginated<Invoice>>('/invoices', { params: { page: 1, limit: 100, status } })).data.data,
        ),
      );
      const seen = new Set<string>();
      return pages.flat().filter((i) => {
        if (seen.has(i.id)) return false;
        seen.add(i.id);
        return true;
      });
    },
    staleTime: 30_000,
  });
  const invoices = payableInvoices ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { invoiceId: '', amount: 0, method: 'bank', reference: '', paidAt: new Date().toISOString().slice(0, 10), note: '' },
  });

  const selectedInvoice = invoices.find((i) => i.id === watch('invoiceId'));

  const save = async (values: FormValues) => {
    try {
      await api.post('/payments', {
        invoiceId: values.invoiceId,
        amount: values.amount,
        method: values.method,
        reference: values.reference || undefined,
        paidAt: values.paidAt,
        note: values.note || undefined,
      });
      toast.success('Payment recorded');
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      await queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onSuccess();
    } catch (err) {
      toast.error('Could not record payment', getErrorMessage(err));
    }
  };

  if (invoicesLoading) {
    return <p className="py-8 text-center text-sm text-ink-400">Loading invoices…</p>;
  }

  if (invoices.length === 0) {
    return (
      <div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          No unpaid invoices available. Send or create an invoice before recording a payment.
        </p>
        {onCancel && (
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={onCancel}>Back to payments</Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form id="record-payment-form" onSubmit={handleSubmit(save)} className="space-y-4">
      <Field label="Invoice">
        <select
          className="input-base"
          {...register('invoiceId')}
          onChange={(e) => {
            const id = e.target.value;
            setValue('invoiceId', id);
            const inv = invoices.find((i) => i.id === id);
            if (inv) setValue('amount', Number((inv.total - inv.amountPaid).toFixed(2)));
          }}
        >
          <option value="">Select an invoice…</option>
          {invoices.map((i) => (
            <option key={i.id} value={i.id}>
              {i.invoiceNumber} · {i.clientName} · {formatMoney(i.total - i.amountPaid)} due
            </option>
          ))}
        </select>
        {errors.invoiceId && <p className="mt-1 text-xs text-red-500">{errors.invoiceId.message}</p>}
      </Field>
      {selectedInvoice && (
        <p className="-mt-2 text-xs text-ink-500">
          Balance due:{' '}
          <span className="font-semibold text-ink-800">{formatMoney(selectedInvoice.total - selectedInvoice.amountPaid)}</span>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Amount *" type="number" step="0.01" min="0.01" {...register('amount')} error={errors.amount?.message} />
        <Input label="Date *" type="date" {...register('paidAt')} error={errors.paidAt?.message} />
      </div>
      <Field label="Method">
        <select className="input-base" {...register('method')}>
          <option value="card">Card</option>
          <option value="bank">Bank transfer</option>
          <option value="cash">Cash</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Input label="Reference" placeholder="e.g. bank reference, check #" {...register('reference')} error={errors.reference?.message} />
      <Input label="Note" {...register('note')} error={errors.note?.message} />
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="secondary" type="button" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" form="record-payment-form" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}