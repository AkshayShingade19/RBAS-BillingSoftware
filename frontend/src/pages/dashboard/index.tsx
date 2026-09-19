import { Link } from 'react-router-dom';
import { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Receipt, Wallet, AlertTriangle, ArrowRight, Banknote,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { api } from '@/lib/api';
import { DashboardData } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { LoadingBlock } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatMoney, formatDate, timeAgo } from '@/lib/utils';
import { useAuth } from '@/store/auth';

export default function DashboardPage() {
  const { hasPermission } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<DashboardData>('/reports/dashboard')).data,
    enabled: Boolean(hasPermission('report.read')),
  });

  if (!hasPermission('report.read')) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-ink-500">You don't have permission to view the dashboard yet.</p>
      </div>
    );
  }

  if (isLoading) return <LoadingBlock />;
  if (!data) return null;

  const revenue = data.revenue;
  const currency = 'USD';

  const chartData = (revenue?.byMonth ?? []).map((m) => ({
    name: `${monthShort(m.month)}`,
    Payment: m.sum,
  }));

  const methodData = (revenue?.byMethod ?? []).map((m) => ({
    name: capitalizeMethod(m.method),
    value: m.sum,
  }));
  void methodData;

  const totalOutstanding = revenue?.invoiced - revenue?.paymentsReceived;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-ink-500">
          Year-to-date. {new Date().getFullYear()}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-brand-600" />}
          label="Payments received"
          value={formatMoney(revenue?.paymentsReceived, currency)}
          hint={`${revenue?.paymentCount ?? 0} payments`}
        />
        <StatCard
          icon={<Receipt className="h-5 w-5 text-indigo-500" />}
          label="Invoiced"
          value={formatMoney(revenue?.invoiced, currency)}
          hint="Invoices issued"
        />
        <StatCard
          icon={<Wallet className="h-5 w-5 text-amber-500" />}
          label="Expenses"
          value={formatMoney(revenue?.expenses, currency)}
          hint="Recorded spend"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          label="Overdue"
          value={String(data.overdueCount ?? 0)}
          hint="Overdue invoices"
          to="/invoices?status=overdue"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Payments received by month</h2>
              <p className="text-xs text-ink-400">This year</p>
            </div>
            <Link to="/reports" className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
              Full reports <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {chartData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8E5F2" />
                <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} stroke="#8A86A3" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#8A86A3" />
                <Tooltip formatter={(value: number) => [formatMoney(value, currency), 'Payments']} />
                <Bar dataKey="Payment" fill="#6D4AFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink-900">Recent payments</h2>
          <p className="text-xs text-ink-400">Latest money received</p>
          <div className="mt-3 space-y-3">
            {(data.recentPayments ?? []).length === 0 && (
              <p className="py-8 text-center text-sm text-ink-400">No payments yet.</p>
            )}
            {data.recentPayments?.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Banknote className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800">{p.clientName}</p>
                  <p className="text-xs text-ink-400">{p.paymentNumber} · {timeAgo(p.paidAt)}</p>
                </div>
                <span className="text-sm font-semibold text-emerald-600">+{formatMoney(p.amount, currency)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-ink-900">Outstanding</h2>
              <p className="text-xs text-ink-400">Unpaid on invoiced amount</p>
            </div>
            <Badge className="bg-amber-50 text-amber-700">{formatMoney(Math.max(0, totalOutstanding), currency)}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-emerald-50 p-4">
              <p className="text-lg font-bold text-emerald-700">{formatMoney(revenue?.paymentsReceived, currency)}</p>
              <p className="text-xs text-emerald-600">Collected</p>
            </div>
            <div className="rounded-lg bg-ink-50 p-4">
              <p className="text-lg font-bold text-ink-800">{formatMoney(Math.max(0, totalOutstanding), currency)}</p>
              <p className="text-xs text-ink-500">Still owed</p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold text-ink-900">Net position</h2>
          <p className="text-xs text-ink-400">Collected minus expenses</p>
          <p className={`mt-3 text-2xl font-bold ${revenue?.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatMoney(revenue?.net, currency)}
          </p>
          <div className="mt-4 space-y-2 text-sm text-ink-600">
            <MiniBar label="Collected" value={revenue?.paymentsReceived ?? 0} />
            <MiniBar label="Rolled up invoiced" value={revenue?.invoiced ?? 0} />
            <div className="flex justify-between text-xs text-ink-400">
              <span>Last payment: {data.recentPayments?.[0] ? formatDate(data.recentPayments[0].paidAt) : '—'}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function monthShort(m: number) {
  return new Date(2000, m - 1, 1).toLocaleString('en', { month: 'short' });
}

function capitalizeMethod(m: string) {
  return m.charAt(0).toUpperCase() + m.slice(1);
}

function StatCard({
  icon, label, value, hint, to,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  to?: string;
}) {
  const body = (
    <Card className="flex items-start gap-3 p-5 transition hover:shadow-pop">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-50">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
        <p className="mt-0.5 truncate text-lg font-bold text-ink-900">{value}</p>
        {hint && <p className="text-xs text-ink-400">{hint}</p>}
      </div>
    </Card>
  );
  if (to) {
    return (
      <Link to={to} className="block">
        {body}
      </Link>
    );
  }
  return body;
}

function MiniBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-xs text-ink-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
        <div className="h-full max-w-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (value / (value || 1)) * 50)}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right text-xs font-medium text-ink-700">{formatMoney(value, 'USD')}</span>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-ink-400">
      No payments recorded yet this year.
    </div>
  );
}