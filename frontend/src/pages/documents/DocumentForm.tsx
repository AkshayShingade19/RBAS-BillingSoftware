import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { api, getErrorMessage } from '@/lib/api';
import { Client, Invoice, Paginated, Quote, Tax } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Field, Select } from '@/components/ui/Input';
import { LineItemsEditor, LineItemFormValues, DocumentFormShape } from '@/components/LineItemsEditor';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/auth';

type Kind = 'invoice' | 'quote';

const schema = z.object({
  clientId: z.string().min(1, 'Select a client'),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().optional(),
  validUntil: z.string().optional(),
  currency: z.string().min(1, 'Currency is required'),
  items: z
    .array(
      z.object({
        description: z.string().min(1, 'Description is required'),
        quantity: z.number().min(0),
        unitPrice: z.number().min(0),
        taxPercent: z.number().min(0),
      }),
    )
    .min(1, 'Add at least one line item'),
  discount: z.object({
    type: z.enum(['percent', 'fixed']),
    value: z.number().min(0),
  }),
  notes: z.string().max(2000).optional().or(z.literal('')),
  terms: z.string().max(2000).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;

export function DocumentForm({
  kind,
  doc,
  editId,
}: {
  kind: Kind;
  doc?: Invoice | Quote | null;
  editId?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { user } = useAuth();

  const resource = kind === 'invoice' ? 'invoice' : 'quote';
  const label = kind === 'invoice' ? 'invoice' : 'quote';
  const dateFieldName = kind === 'invoice' ? 'dueDate' : 'validUntil' as const;
  const dateFieldLabel = kind === 'invoice' ? 'Due date' : 'Valid until';

  const existing = doc;

  const fromItems = (items?: LineItemFormValues[]) =>
    items?.map((i) => ({
      description: i.description,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      taxPercent: Number(i.taxPercent ?? 0),
    })) ?? [{ description: '', quantity: 1, unitPrice: 0, taxPercent: 0 }];

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      clientId: existing?.clientId ?? '',
      issueDate: existing ? String(existing.issueDate).slice(0, 10) : new Date().toISOString().slice(0, 10),
      dueDate: existing ? String((existing as any).dueDate ?? '').slice(0, 10) : '',
      validUntil: existing ? String((existing as any).validUntil ?? '').slice(0, 10) : '',
      currency: existing?.currency || 'USD',
      items: fromItems(existing?.items as LineItemFormValues[]),
      discount: existing?.discount
        ? { type: existing.discount.type, value: Number(existing.discount.value) }
        : { type: 'percent' as const, value: 0 },
      notes: existing?.notes ?? '',
      terms: existing?.terms ?? '',
    },
  });

  const { register, handleSubmit, watch, formState } = form;
  const items = (watch('items') ?? []) as LineItemFormValues[];
  const discount = (watch('discount') ?? { type: 'percent', value: 0 }) as { type: 'percent' | 'fixed'; value: number };
  const currency = watch('currency') || 'USD';

  const { data: clients } = useQuery({
    queryKey: ['clients', 'form-options'],
    queryFn: async () =>
      (await api.get<Paginated<Client>>('/clients', { params: { limit: 100, status: 'active' } })).data.data,
    enabled: true,
  });

  const { data: taxes } = useQuery({
    queryKey: ['taxes', 'form-options'],
    queryFn: async () =>
      (await api.get<Paginated<Tax>>('/taxes', { params: { limit: 100, status: 'active' } })).data.data,
    enabled: true,
  });

  const taxOptions = [
    { value: 'none', label: 'No tax', rate: 0 },
    ...(taxes ?? []).map((t) => ({ value: t._id, label: `${t.name} (${t.rate}%)`, rate: t.rate })),
  ];

  const fmt = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency });

  const subtotal = items.reduce((s, i) => s + (Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0), 0);
  const discountAmount =
    discount.type === 'percent' ? (subtotal * (Number(discount.value) || 0)) / 100 : Number(discount.value) || 0;
  const taxTotal = items.reduce(
    (s, i) => s + ((Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0) * (Number(i?.taxPercent) || 0)) / 100,
    0,
  );
  const total = Math.max(0, subtotal - discountAmount + taxTotal);

  const onSubmit = async (values: FormValues) => {
    const payloadObj = {
      clientId: values.clientId,
      issueDate: values.issueDate,
      currency: values.currency || 'USD',
      [dateFieldName]: values[dateFieldName],
      items: (values.items ?? []).map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxPercent: i.taxPercent,
      })),
      discount: { type: discount.type, value: Number(discount.value) || 0 },
      notes: values.notes || undefined,
      terms: values.terms || undefined,
    };
    try {
      let createdId: string | null = null;
      if (editId) {
        await api.patch(`/${resource}s/${editId}`, payloadObj);
        toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} updated`);
        createdId = editId;
      } else {
        const res = await api.post<{ id?: string; _id?: string }>(`/${resource}s`, payloadObj);
        createdId = res.data?.id ?? res.data?._id ?? null;
        toast.success(`${label.charAt(0).toUpperCase() + label.slice(1)} created`);
      }
      await queryClient.invalidateQueries({ queryKey: [`${resource}s`] });
      navigate(createdId ? `/${resource}s/${createdId}` : `/${resource}s`);
    } catch (err) {
      toast.error(`Could not save ${label}`, getErrorMessage(err));
    }
  };

  const editorForm = form as unknown as UseFormReturn<DocumentFormShape>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={editId ? `Edit ${label}` : `New ${label}`}
        subtitle={existing ? `Current number: ${(existing as any).invoiceNumber ?? (existing as any).quoteNumber}` : 'Number is assigned automatically on save.'}
        actions={
          <Button variant="secondary" onClick={() => navigate(`/${resource}s`)}>
            Cancel
          </Button>
        }
      />

      <form id="doc-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client *">
              <Select placeholder="Select a client…" {...register('clientId')}>
                <option value="">Select a client…</option>
                {(clients ?? []).map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </Select>
              {formState.errors.clientId && (
                <p className="mt-1 text-xs text-red-500">{formState.errors.clientId.message}</p>
              )}
            </Field>
            <Field label="Currency">
              <Select {...register('currency')}>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="NGN">NGN — Nigerian Naira</option>
                <option value="KES">KES — Kenyan Shilling</option>
                <option value="GHS">GHS — Ghanaian Cedi</option>
                <option value="ZAR">ZAR — South African Rand</option>
              </Select>
            </Field>
            <Input label="Issue date *" type="date" {...register('issueDate')} error={formState.errors.issueDate?.message} />
            <Input
              label={`${dateFieldLabel} *`}
              type="date"
              {...register(dateFieldName === 'dueDate' ? 'dueDate' : 'validUntil')}
              error={formState.errors[dateFieldName]?.message}
            />
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-base font-semibold text-ink-900">Line items</h2>
          <LineItemsEditor form={editorForm} taxOptions={taxOptions} />
          {formState.errors.items?.message && (
            <p className="mt-2 text-xs text-red-500">{String(formState.errors.items.message)}</p>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <h2 className="mb-3 text-base font-semibold text-ink-900">Discount</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select {...register('discount.type')}>
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed amount</option>
                </Select>
              </Field>
              <Input label="Value" type="number" min="0" step="any" {...register('discount.value', { valueAsNumber: true })} />
            </div>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-base font-semibold text-ink-900">Totals</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-ink-500">Subtotal</dt>
                <dd className="font-medium text-ink-900">{fmt(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Discount</dt>
                <dd className="font-medium text-red-500">-{fmt(discountAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-500">Tax</dt>
                <dd className="font-medium text-ink-900">{fmt(taxTotal)}</dd>
              </div>
              <div className="flex justify-between border-t border-ink-100 pt-2 text-base">
                <dt className="font-semibold text-ink-900">Total</dt>
                <dd className="font-bold text-brand-700">{fmt(total)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-base font-semibold text-ink-900">Notes & terms</h2>
          <div className="space-y-4">
            <Input label="Notes to client" {...register('notes')} error={formState.errors.notes?.message} />
            <Input label="Terms & conditions" {...register('terms')} error={formState.errors.terms?.message} />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-ink-100 pt-4">
          <span className="mr-auto text-xs text-ink-400">Signed in as {user?.name}</span>
          <Button variant="secondary" type="button" onClick={() => navigate(`/${resource}s`)}>
            Cancel
          </Button>
          <Button type="submit" loading={formState.isSubmitting}>
            {editId ? 'Save changes' : `Create ${label}`}
          </Button>
        </div>
      </form>
    </div>
  );
}