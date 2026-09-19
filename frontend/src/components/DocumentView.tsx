import { Invoice, Quote, LineItem } from '@/lib/types';
import { formatMoney, formatDate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';

interface DocLike {
  clientName: string;
  issueDate: string;
  validUntil?: string;
  dueDate?: string;
  status: string;
  discount: { type: 'percent' | 'fixed'; value: number };
  items: LineItem[];
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  total: number;
  amountPaid?: number;
  currency: string;
  notes?: string;
  terms?: string;
}

export function DocumentView({ doc, company, kind }: { doc: DocLike; company?: any; kind: 'invoice' | 'quote' }) {
  const number = (doc as Invoice).invoiceNumber ?? (doc as Quote).quoteNumber;
  const dateLabel = kind === 'invoice' ? 'Due date' : 'Valid until';
  const dateValue = kind === 'invoice' ? doc.dueDate : doc.validUntil;
  const currency = doc.currency || 'USD';

  const rows: { label: string; value: string }[] = [
    { label: 'Number', value: number },
    { label: 'Issue date', value: formatDate(doc.issueDate) },
    { label: dateLabel, value: dateValue ? formatDate(dateValue) : '—' },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl bg-white">
      <div className="border-b border-ink-100 pb-5">
        <div className="flex items-start justify-between">
          <div>
            {company?.logoUrl ? (
              <img src={company.logoUrl} alt="Logo" className="h-10 w-10 rounded object-contain" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-lg font-extrabold text-white">
                {(company?.name ?? 'L').charAt(0)}
              </div>
            )}
            <p className="mt-2 text-lg font-bold text-ink-900">{company?.legalName || company?.name || 'Your Company'}</p>
            {company?.address && (
              <p className="max-w-xs text-xs text-ink-500">
                {[company.address.line1, company.address.city, company.address.state, company.address.zip, company.address.country]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <h2 className="text-2xl font-extrabold uppercase tracking-wide text-ink-900">{kind}</h2>
              <StatusBadge status={doc.status} />
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              {rows.map((r) => (
                <div key={r.label} className="flex justify-end gap-2 text-ink-500">
                  <dt className="text-right">{r.label}:</dt>
                  <dd className="w-32 text-right font-medium text-ink-800">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      <div className="border-b border-ink-100 py-5">
        <h3 className="text-sm font-semibold text-ink-800">Billed to</h3>
        <p className="mt-1 text-lg font-semibold text-ink-900">{doc.clientName}</p>
      </div>

      <div className="my-5 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50/60 text-xs uppercase tracking-wide text-ink-500">
              <th className="th">Description</th>
              <th className="th w-20 text-right">Qty</th>
              <th className="th w-28 text-right">Unit price</th>
              <th className="th w-20 text-right">Tax</th>
              <th className="th w-28 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {doc.items?.map((item, idx) => (
              <tr key={idx}>
                <td className="td text-sm text-ink-800">{item.description}</td>
                <td className="td text-right text-sm text-ink-600">{item.quantity}</td>
                <td className="td text-right text-sm text-ink-600">{formatMoney(item.unitPrice, currency)}</td>
                <td className="td text-right text-sm text-ink-600">{item.taxPercent ? `${item.taxPercent}%` : '—'}</td>
                <td className="td text-right text-sm font-semibold text-ink-900">{formatMoney(item.amount ?? 0, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ml-auto w-full max-w-sm">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between text-ink-500">
            <dt>Subtotal</dt>
            <dd className="font-medium text-ink-800">{formatMoney(doc.subtotal, currency)}</dd>
          </div>
          {doc.discountAmount > 0 && (
            <div className="flex justify-between text-ink-500">
              <dt>Discount{doc.discount?.type === 'percent' ? ` (${doc.discount.value}%)` : ''}</dt>
              <dd className="font-medium text-red-500">-{formatMoney(doc.discountAmount, currency)}</dd>
            </div>
          )}
          <div className="flex justify-between text-ink-500">
            <dt>Tax</dt>
            <dd className="font-medium text-ink-800">{formatMoney(doc.taxTotal, currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-ink-100 pt-2 text-base font-bold text-ink-900">
            <dt>Total</dt>
            <dd>{formatMoney(doc.total, currency)}</dd>
          </div>
          {doc.amountPaid ? (
            <div className="flex justify-between text-sm text-ink-600">
              <dt>Paid</dt>
              <dd className="font-medium text-emerald-600">{formatMoney(doc.amountPaid, currency)}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {(doc.notes || doc.terms) && (
        <div className="mt-8 grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
          {doc.notes && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Notes</h4>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{doc.notes}</p>
            </div>
          )}
          {doc.terms && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-400">Terms</h4>
              <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{doc.terms}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}