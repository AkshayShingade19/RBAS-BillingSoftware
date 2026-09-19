import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { Download, Banknote, Receipt, Wallet, TrendingUp } from 'lucide-react';
import { api, downloadCsv } from '@/lib/api';
import {
  RevenueReport, InvoiceStatusReport, TopClientReport, OverdueAgingReport, TaxSummaryReport,
} from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { Card, LoadingBlock } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { formatMoney } from '@/lib/utils';
import { useAuth } from '@/store/auth';

const STATUS_COLORS: Record<string, string> = {
  draft: '#8A86A3',
  sent: '#60A5FA',
  partial: '#F59E0B',
  paid: '#10B981',
  overdue: '#EF4444',
  void: '#9CA3AF',
};

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const range = { from, to };

  const revenue = useQuery({
    queryKey: ['reports', 'revenue', from, to],
    queryFn: async () => (await api.get<RevenueReport>('/reports/revenue', { params: range })).data,
    enabled: Boolean(hasPermission('report.read')),
  });

  const invoiceStatus = useQuery({
    queryKey: ['reports', 'invoice-status', from, to],
    queryFn: async () => (await api.get<InvoiceStatusReport[]>('/reports/invoice-status', { params: range })).data,
    enabled: Boolean(hasPermission('report.read')),
  });

  const topClients = useQuery({
    queryKey: ['reports', 'top-clients', from, to],
    queryFn: async () => (await api.get<TopClientReport[]>('/reports/top-clients', { params: { ...range, limit: 10 } })).data,
    enabled: Boolean(hasPermission('report.read')),
  });

  const overdueAging = useQuery({
    queryKey: ['reports', 'overdue-aging', from, to],
    queryFn: async () => (await api.get<OverdueAgingReport[]>('/reports/overdue-aging', { params: range })).data,
    enabled: Boolean(hasPermission('report.read')),
  });

  const taxSummary = useQuery({
    queryKey: ['reports', 'tax-summary', from, to],
    queryFn: async () => (await api.get<TaxSummaryReport[]>('/reports/tax-summary', { params: range })).data,
    enabled: Boolean(hasPermission('report.read')),
  });

  if (!hasPermission('report.read')) {
    return <p className="py-16 text-center text-sm text-ink-500">You don't have permission to view reports.</p>;
  }

  const loading = revenue.isLoading || invoiceStatus.isLoading || topClients.isLoading || overdueAging.isLoading || taxSummary.isLoading;

  const revenueData = revenue.data;
  const statusData = invoiceStatus.data ?? [];
  const topData = topClients.data ?? [];
  const agingData = overdueAging.data ?? [];
  const taxData = taxSummary.data?.[0];

  const revenueChartData = (revenueData?.byMonth ?? []).map((m) => ({
    month: new Date(2000, m.month - 1, 1).toLocaleString('en', { month: 'short' }),
    collected: m.sum,
  }));

  const pieData = statusData.map((s) => ({
    name: s.status,
    value: s.count * s.total,
    color: STATUS_COLORS[s.status] ?? '#8A86A3',
  }));

  const exportSection = (section: 'revenue' | 'invoice-status' | 'top-clients' | 'overdue-aging' | 'tax-summary') =>
    downloadCsv(`/reports/export/${section}`, { ...range, limit: 50 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Understand revenue, collections and outstanding balances."
        actions={
          <div className="flex items-end gap-3">
            <Input type="date" label="From" value={from} onChange={(e) => setFrom(e.target.value)} containerClassName="w-auto" />
            <Input type="date" label="To" value={to} onChange={(e) => setTo(e.target.value)} containerClassName="w-auto" />
          </div>
        }
      />

      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard icon={<Banknote className="h-5 w-5 text-emerald-600" />} label="Payments received" value={formatMoney(revenueData?.paymentsReceived)} hint={`${revenueData?.paymentCount ?? 0} payments`} />
            <SummaryCard icon={<Receipt className="h-5 w-5 text-brand-600" />} label="Invoiced" value={formatMoney(revenueData?.invoiced)} hint="Non-void invoices" />
            <SummaryCard icon={<Wallet className="h-5 w-5 text-amber-600" />} label="Expenses" value={formatMoney(revenueData?.expenses)} hint="All expense statuses" />
            <SummaryCard icon={<TrendingUp className="h-5 w-5 text-indigo-600" />} label="Net" value={formatMoney(revenueData?.net)} hint="Collected minus expenses" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <CardTitle
                title="Cash collected by month"
                onExport={hasPermission('report.export') ? () => exportSection('revenue') : undefined}
              />
              {revenueChartData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={revenueChartData} margin={{ left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E5F2" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="#8A86A3" />
                    <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#8A86A3" />
                    <Tooltip formatter={(v: number) => formatMoney(v)} />
                    <Bar dataKey="collected" fill="#10B981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-20 text-center text-sm text-ink-400">No payments in this period.</p>
              )}
            </Card>

            <Card className="p-5">
              <CardTitle
                title="Invoice status distribution"
                onExport={hasPermission('report.export') ? () => exportSection('invoice-status') : undefined}
              />
              {pieData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85} paddingAngle={2}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatMoney(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-20 text-center text-sm text-ink-400">No invoices in this period.</p>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <CardTitle
                title="Invoice status breakdown"
                onExport={hasPermission('report.export') ? () => exportSection('invoice-status') : undefined}
              />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                      <th className="py-2 pr-4 text-left font-semibold">Status</th>
                      <th className="py-2 pr-4 text-right font-semibold">Invoices</th>
                      <th className="py-2 pr-4 text-right font-semibold">Total</th>
                      <th className="py-2 pr-4 text-right font-semibold">Paid</th>
                      <th className="py-2 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {statusData.map((s) => (
                      <tr key={s.status}>
                        <td className="py-2 pr-4 capitalize text-ink-800">{s.status}</td>
                        <td className="py-2 pr-4 text-right text-ink-700">{s.count}</td>
                        <td className="py-2 pr-4 text-right text-ink-700">{formatMoney(s.total)}</td>
                        <td className="py-2 pr-4 text-right text-ink-700">{formatMoney(s.paid)}</td>
                        <td className="py-2 text-right font-semibold text-ink-900">{formatMoney(s.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-5">
              <CardTitle
                title="Overdue aging"
                onExport={hasPermission('report.export') ? () => exportSection('overdue-aging') : undefined}
              />
              {agingData.length ? (
                <div className="space-y-3">
                  {agingData.map((b) => (
                    <div key={b.label} className="flex items-center justify-between rounded-lg border border-ink-100 p-3">
                      <div>
                        <p className="text-sm font-semibold text-ink-800">{b.label}</p>
                        <p className="text-xs text-ink-400">{b.count} overdue invoice{b.count === 1 ? '' : 's'}</p>
                      </div>
                      <span className="text-sm font-bold text-red-500">{formatMoney(b.total)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-20 text-center text-sm text-ink-400">Nothing overdue. Nice work!</p>
              )}
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-1">
              <CardTitle
                title="Top clients by invoiced amount"
                onExport={hasPermission('report.export') ? () => exportSection('top-clients') : undefined}
              />
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-400">
                      <th className="py-2 pr-4 text-left font-semibold">Client</th>
                      <th className="py-2 pr-4 text-right font-semibold">Invoiced</th>
                      <th className="py-2 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {topData.map((c) => (
                      <tr key={c.client}>
                        <td className="py-2 pr-4 text-ink-800">{c.client}</td>
                        <td className="py-2 pr-4 text-right text-ink-700">{formatMoney(c.invoiced)}</td>
                        <td className="py-2 text-right font-semibold text-ink-900">{formatMoney(c.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <CardTitle
                title="Tax summary"
                onExport={hasPermission('report.export') ? () => exportSection('tax-summary') : undefined}
              />
              {taxData ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-ink-50 p-4">
                    <p className="text-xs text-ink-400">Subtotal</p>
                    <p className="mt-1 text-lg font-bold text-ink-900">{formatMoney(taxData.subtotal)}</p>
                  </div>
                  <div className="rounded-lg bg-ink-50 p-4">
                    <p className="text-xs text-ink-400">Tax total</p>
                    <p className="mt-1 text-lg font-bold text-ink-900">{formatMoney(taxData.taxTotal)}</p>
                  </div>
                  <div className="rounded-lg bg-brand-50 p-4">
                    <p className="text-xs text-brand-600">Effective rate</p>
                    <p className="mt-1 text-lg font-bold text-brand-700">{taxData.percent.toFixed(2)}%</p>
                  </div>
                </div>
              ) : (
                <p className="py-16 text-center text-sm text-ink-400">No tax data in this period.</p>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-ink-100 bg-white p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-50">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-400">{label}</p>
        <p className="mt-0.5 truncate text-lg font-bold text-ink-900">{value}</p>
        {hint && <p className="text-xs text-ink-400">{hint}</p>}
      </div>
    </div>
  );
}

function CardTitle({ title, onExport }: { title: string; onExport?: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      {onExport && (
        <Button variant="secondary" size="sm" onClick={onExport}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      )}
    </div>
  );
}
