import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SystemConfig } from '@/lib/types';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { data: config } = useQuery({
    queryKey: ['system-config'],
    queryFn: async () => (await api.get<SystemConfig>('/system/config')).data,
    staleTime: 5 * 60_000,
  });

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-ink-900 p-10 lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-base font-extrabold text-white">
            L
          </span>
          <div>
            <p className="text-lg font-bold text-white">{config?.appName ?? 'Ledgerly'}</p>
            <p className="text-xs text-ink-400">by RBAS TechLabs</p>
          </div>
        </div>
        <div className="relative">
          <blockquote className="max-w-md text-2xl font-semibold leading-snug text-white">
            “Billing that works as hard as you do.”
          </blockquote>
          <p className="mt-4 text-sm text-ink-400">
            Invoices, quotes, payments and reports — in one tidy workspace.
          </p>
        </div>
        <p className="relative text-xs text-ink-500">
          {config?.footerCompanyName ?? 'Ledgerly by RBAS TechLabs'} · {toYear()}
        </p>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-ink-50 px-4 py-10 lg:w-1/2">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-extrabold text-white">
            L
          </span>
          <span className="text-lg font-bold text-ink-900">{config?.appName ?? 'Ledgerly'}</span>
        </div>
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-bold text-ink-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-ink-500">{footer}</div>}
        </div>
        <p className="mt-10 text-xs text-ink-400">
          <Link to="/" className="hover:text-ink-600">Ledgerly Home</Link> · {toYear()}
        </p>
      </div>
    </div>
  );
}

function toYear() {
  return new Date().getFullYear();
}