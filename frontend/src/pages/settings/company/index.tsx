import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Save, Loader2 } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { Company } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';
import { Card, LoadingBlock } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/auth';

export default function CompanyPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('settings.manage');

  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get<Company>('/company')).data,
    enabled: hasPermission('company.read'),
  });

  const [form, setForm] = useState<Company | null>(null);

  useEffect(() => {
    if (company && !form) setForm({ ...company });
  }, [company, form]);

  if (!hasPermission('company.read')) {
    return <p className="py-16 text-center text-sm text-ink-500">You don't have permission to view company settings.</p>;
  }

  const set = (patch: Partial<Company>) => {
    if (form) setForm({ ...form, ...patch, address: { ...form.address, ...(patch.address ?? {}) } });
  };

  const save = useMutation({
    mutationFn: async (body: unknown) => api.patch('/company', body),
    onSuccess: async () => {
      toast.success('Company settings saved');
      await queryClient.invalidateQueries({ queryKey: ['company'] });
    },
    onError: (err) => toast.error('Could not save company settings', getErrorMessage(err)),
  });

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!form) return;
    const { name, value } = e.target;
    const isNumber = name.endsWith('NextNumber') || name === 'defaultPaymentTermsDays';
    set({ [name]: isNumber ? Number(value.replace(/\D/g, '')) || 1 : value } as Partial<Company>);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form) save.mutate(form);
  };

  if (isLoading) return <LoadingBlock />;
  if (!form) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company"
        subtitle="Your billing identity and document numbering."
        actions={canManage ? (
          <Button form="company-form" type="submit" loading={save.isPending} disabled={form === company}>
            <Save className="h-4 w-4" /> Save changes
          </Button>
        ) : <span className="text-xs text-ink-400">Read-only</span>}
      />

      <form id="company-form" onSubmit={submit} className="space-y-6">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-ink-900">
            <Building2 className="h-4 w-4 text-brand-500" /> Business details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Company name *" name="name" value={form.name} onChange={onChange} disabled={!canManage} />
            <Input label="Legal name" name="legalName" value={form.legalName} onChange={onChange} disabled={!canManage} />
            <Input label="Email *" type="email" name="email" value={form.email} onChange={onChange} disabled={!canManage} />
            <Input label="Phone" name="phone" value={form.phone} onChange={onChange} disabled={!canManage} />
            <Input label="Website" name="website" value={form.website} onChange={onChange} disabled={!canManage} />
            <Input label="Currency (ISO, e.g. USD)" name="currency" value={form.currency} onChange={onChange} disabled={!canManage} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Address line" name="line1" value={form.address?.line1 ?? ''} onChange={(e) => set({ address: { ...form.address, line1: e.target.value } })} disabled={!canManage} />
            <Input label="City" name="city" value={form.address?.city ?? ''} onChange={(e) => set({ address: { ...form.address, city: e.target.value } })} disabled={!canManage} />
            <Input label="State" name="state" value={form.address?.state ?? ''} onChange={(e) => set({ address: { ...form.address, state: e.target.value } })} disabled={!canManage} />
            <Input label="ZIP / Postal code" name="zip" value={form.address?.zip ?? ''} onChange={(e) => set({ address: { ...form.address, zip: e.target.value } })} disabled={!canManage} />
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Document numbering</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Invoice prefix">
              <div className="flex items-center gap-2">
                <input className="input-base" name="invoicePrefix" value={form.invoicePrefix} onChange={onChange} disabled={!canManage} />
              </div>
            </Field>
            <Field label="Next invoice number">
              <input className="input-base" inputMode="numeric" name="invoiceNextNumber" value={form.invoiceNextNumber} onChange={onChange} disabled={!canManage} />
            </Field>
            <div className="flex items-end pb-1">
              <span className="font-mono text-sm text-ink-400">{form.invoicePrefix}{String(form.invoiceNextNumber).padStart(4, '0')}</span>
            </div>
            <Field label="Quote prefix">
              <input className="input-base" name="quotePrefix" value={form.quotePrefix} onChange={onChange} disabled={!canManage} />
            </Field>
            <Field label="Next quote number">
              <input className="input-base" inputMode="numeric" name="quoteNextNumber" value={form.quoteNextNumber} onChange={onChange} disabled={!canManage} />
            </Field>
            <div className="flex items-end pb-1">
              <span className="font-mono text-sm text-ink-400">{form.quotePrefix}{String(form.quoteNextNumber).padStart(4, '0')}</span>
            </div>
            <Field label="Payment prefix">
              <input className="input-base" name="paymentPrefix" value={form.paymentPrefix} onChange={onChange} disabled={!canManage} />
            </Field>
            <Field label="Next payment number">
              <input className="input-base" inputMode="numeric" name="paymentNextNumber" value={form.paymentNextNumber} onChange={onChange} disabled={!canManage} />
            </Field>
            <div className="flex items-end pb-1">
              <span className="font-mono text-sm text-ink-400">{form.paymentPrefix}{String(form.paymentNextNumber).padStart(4, '0')}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-base font-semibold text-ink-900">Invoice defaults</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input label="Tax label" name="taxLabel" value={form.taxLabel} onChange={onChange} disabled={!canManage} />
            <Field label="Payment terms (days)">
              <input className="input-base" inputMode="numeric" name="defaultPaymentTermsDays" value={form.defaultPaymentTermsDays} onChange={onChange} disabled={!canManage} />
            </Field>
            <Field label="Logo URL (optional)">
              <input className="input-base" name="logoUrl" value={form.logoUrl} onChange={onChange} disabled={!canManage} placeholder="https://…" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Footer note">
                <input className="input-base" name="footerNote" value={form.footerNote} onChange={onChange} disabled={!canManage} />
              </Field>
            </div>
          </div>
        </Card>

        {!canManage && (
          <p className="flex items-center gap-2 text-sm text-ink-400">
            <Loader2 className="h-4 w-4" /> You have read-only access to company settings.
          </p>
        )}
      </form>
    </div>
  );
}