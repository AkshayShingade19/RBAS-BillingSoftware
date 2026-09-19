import { useMemo, useState, ReactNode } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  NotebookPen,
  Banknote,
  Users,
  Package,
  Percent,
  Wallet,
  BarChart3,
  Bell,
  Settings,
  ShieldCheck,
  Building2,
  ScrollText,
  Cpu,
  Search,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { api } from '@/lib/api';
import { Company, SearchResult } from '@/lib/types';
import { cn, initials } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  permission?: string;
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => (await api.get<Company>('/company')).data,
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      const res = await api.get<{ count: number }>('/notifications/unread-count');
      return res.data.count;
    },
    enabled: Boolean(user),
    refetchInterval: 30_000,
  });

  const { data: searchResults } = useQuery<SearchResult>({
    queryKey: ['search', searchTerm],
    queryFn: async () => (await api.get<SearchResult>('/search', { params: { q: searchTerm } })).data,
    enabled: searchOpen && searchTerm.trim().length > 0,
    placeholderData: keepPreviousData,
  });

  const mainNav: NavItem[] = useMemo(
    () => [
      { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" />, permission: 'dashboard.read' },
      { label: 'Invoices', to: '/invoices', icon: <FileText className="h-4 w-4" />, permission: 'invoice.read' },
      { label: 'Quotes', to: '/quotes', icon: <NotebookPen className="h-4 w-4" />, permission: 'quote.read' },
      { label: 'Payments', to: '/payments', icon: <Banknote className="h-4 w-4" />, permission: 'payment.read' },
      { label: 'Clients', to: '/clients', icon: <Users className="h-4 w-4" />, permission: 'client.read' },
      { label: 'Products', to: '/products', icon: <Package className="h-4 w-4" />, permission: 'product.read' },
      { label: 'Taxes', to: '/taxes', icon: <Percent className="h-4 w-4" />, permission: 'tax.read' },
      { label: 'Expenses', to: '/expenses', icon: <Wallet className="h-4 w-4" />, permission: 'expense.read' },
      { label: 'Reports', to: '/reports', icon: <BarChart3 className="h-4 w-4" />, permission: 'report.read' },
    ],
    [],
  );

  const adminNav: NavItem[] = useMemo(
    () => [
      { label: 'Users', to: '/settings/users', icon: <ShieldCheck className="h-4 w-4" />, permission: 'user.read' },
      { label: 'Roles & Permissions', to: '/settings/roles', icon: <ShieldCheck className="h-4 w-4" />, permission: 'role.read' },
      { label: 'Company', to: '/settings/company', icon: <Building2 className="h-4 w-4" />, permission: 'company.read' },
      { label: 'Audit Log', to: '/settings/audit', icon: <ScrollText className="h-4 w-4" />, permission: 'audit.read' },
      { label: 'System', to: '/settings/system', icon: <Cpu className="h-4 w-4" />, permission: 'system.manage' },
    ],
    [],
  );

  const visibleMain = mainNav.filter((n) => !n.permission || hasPermission(n.permission));
  const visibleAdmin = adminNav.filter((n) => !n.permission || hasPermission(n.permission));

  const goToSearchResult = (type: string, id: string) => {
    setSearchOpen(false);
    setSearchTerm('');
    const paths: Record<string, string> = {
      client: '/clients',
      product: '/products',
      invoice: '/invoices',
      quote: '/quotes',
      payment: '/payments',
    };
    navigate(`${paths[type] ?? '/dashboard'}/${id}`);
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-900">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-extrabold text-white">
          L
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white">Ledgerly</p>
          <p className="truncate text-[11px] text-ink-400">{company?.name ?? 'Workspace'}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        <NavSection label="Overview">
          {visibleMain.map((item) => (
            <NavItemLink key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
          ))}
        </NavSection>
        {visibleAdmin.length > 0 && (
          <NavSection label="Administration">
            {visibleAdmin.map((item) => (
              <NavItemLink key={item.to} item={item} onClick={() => setSidebarOpen(false)} />
            ))}
          </NavSection>
        )}
      </nav>

      <div className="border-t border-ink-800 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
            {initials(user?.name ?? 'U')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user?.name}</p>
            <p className="truncate text-[11px] capitalize text-ink-400">{user?.role.replace('_', ' ')}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="rounded-md p-1.5 text-ink-400 transition hover:bg-ink-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-ink-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {sidebar}
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink-100 bg-white/90 px-4 backdrop-blur">
          <button
            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative flex-1 max-w-md">
            <button
              onClick={() => setSearchOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-md border border-ink-200 bg-ink-50 px-3 py-1.5 text-sm text-ink-400 transition hover:border-ink-300"
            >
              <Search className="h-4 w-4" />
              <span>Search clients, invoices, products…</span>
              <kbd className="ml-auto hidden rounded bg-white px-1.5 text-[11px] text-ink-400 ring-1 ring-ink-200 sm:block">
                /
              </kbd>
            </button>
            {searchOpen && (
              <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border border-ink-200 bg-white shadow-pop">
                <div className="flex items-center gap-2 border-b border-ink-100 px-3 py-2">
                  <Search className="h-4 w-4 text-ink-400" />
                  <input
                    autoFocus
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Type to search…"
                    className="w-full text-sm outline-none"
                  />
                  <button onClick={() => setSearchOpen(false)} className="text-ink-400 hover:text-ink-600" aria-label="Close search">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {!searchTerm.trim() ? (
                    <p className="px-3 py-6 text-center text-xs text-ink-400">Search across the workspace</p>
                  ) : searchResults?.clients.length ||
                    searchResults?.invoices.length ||
                    searchResults?.products.length ||
                    searchResults?.quotes.length ||
                    searchResults?.payments.length ? (
                    <div className="py-1">
                      {renderSearchGroup('Clients', searchResults?.clients, goToSearchResult)}
                      {renderSearchGroup('Products', searchResults?.products, goToSearchResult)}
                      {renderSearchGroup('Invoices', searchResults?.invoices, goToSearchResult)}
                      {renderSearchGroup('Quotes', searchResults?.quotes, goToSearchResult)}
                      {renderSearchGroup('Payments', searchResults?.payments, goToSearchResult)}
                    </div>
                  ) : (
                    <p className="px-3 py-6 text-center text-xs text-ink-400">No results found</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/notifications"
              className="relative rounded-md p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-700"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount ? (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </Link>
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md p-1.5 transition hover:bg-ink-100"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
                  {initials(user?.name ?? 'U')}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-pop">
                    <div className="border-b border-ink-100 px-4 py-2.5">
                      <p className="truncate text-sm font-semibold text-ink-900">{user?.name}</p>
                      <p className="truncate text-xs text-ink-500">{user?.email}</p>
                      <Badge className="mt-1.5">{user?.role.replace('_', ' ')}</Badge>
                    </div>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/settings/company');
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
                    >
                      <Settings className="h-4 w-4" /> Account settings
                    </button>
                    <button
                      onClick={logout}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-3 mt-4 first:mt-0">
      <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItemLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition',
          isActive
            ? 'bg-brand-600 text-white'
            : 'text-ink-300 hover:bg-ink-800 hover:text-white',
        )
      }
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
      {item.label}
    </NavLink>
  );
}

function renderSearchGroup(
  label: string,
  items?: { id: string; name?: string; number?: string; clientName?: string; type: string }[],
  onSelect?: (type: string, id: string) => void,
) {
  if (!items?.length) return null;
  return (
    <div className="mb-1">
      <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect?.(item.type, item.id)}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-brand-50"
        >
          <span className="truncate font-medium text-ink-800">{item.name ?? item.number}</span>
          <span className="ml-2 shrink-0 text-xs text-ink-400">{item.clientName}</span>
        </button>
      ))}
    </div>
  );
}