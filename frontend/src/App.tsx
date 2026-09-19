import { Suspense } from 'react';
import { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Layout } from '@/components/Layout';
import { LoadingBlock } from '@/components/ui/Card';
import LoginPage from '@/pages/auth/login';
import SignupPage from '@/pages/auth/signup';
import VerifyEmailPage from '@/pages/auth/verify-email';
import ForgotPasswordPage from '@/pages/auth/forgot-password';
import ResetPasswordPage from '@/pages/auth/reset-password';
import DashboardPage from '@/pages/dashboard';
import InvoicesPage from '@/pages/invoices';
import InvoiceFormPage from '@/pages/invoices/InvoiceForm';
import InvoiceDetailPage from '@/pages/invoices/InvoiceDetail';
import QuotesPage from '@/pages/quotes';
import QuoteFormPage from '@/pages/quotes/QuoteForm';
import QuoteDetailPage from '@/pages/quotes/QuoteDetail';
import PaymentsPage from '@/pages/payments';
import PaymentFormModal from '@/pages/payments/PaymentForm';
import ClientsPage from '@/pages/clients';
import ProductsPage from '@/pages/products';
import TaxesPage from '@/pages/taxes';
import ExpensesPage from '@/pages/expenses';
import ReportsPage from '@/pages/reports';
import NotificationsPage from '@/pages/notifications';
import UsersPage from '@/pages/settings/users';
import RolesPage from '@/pages/settings/roles';
import CompanySettingsPage from '@/pages/settings/company';
import AuditPage from '@/pages/settings/audit';
import SystemSettingsPage from '@/pages/settings/system';
import NotFoundPage from '@/pages/NotFound';

function Protected({ children }: { children: ReactNode }) {
  const { user, tokensValid } = useAuth();
  const ready = user && tokensValid;
  if (!ready) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequiresPermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/"
        element={
          <Protected>
            <Layout>
              <AppRoutes />
            </Layout>
          </Protected>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading workspace…" />}>
      <Routes>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<RequiresPermission permission="dashboard.read"><DashboardPage /></RequiresPermission>} />
        <Route path="/invoices" element={<RequiresPermission permission="invoice.read"><InvoicesPage /></RequiresPermission>} />
        <Route path="/invoices/new" element={<RequiresPermission permission="invoice.create"><InvoiceFormPage /></RequiresPermission>} />
        <Route path="/invoices/:id" element={<RequiresPermission permission="invoice.read"><InvoiceDetailPage /></RequiresPermission>} />
        <Route path="/invoices/:id/edit" element={<RequiresPermission permission="invoice.update"><InvoiceFormPage /></RequiresPermission>} />
        <Route path="/quotes" element={<RequiresPermission permission="quote.read"><QuotesPage /></RequiresPermission>} />
        <Route path="/quotes/new" element={<RequiresPermission permission="quote.create"><QuoteFormPage /></RequiresPermission>} />
        <Route path="/quotes/:id" element={<RequiresPermission permission="quote.read"><QuoteDetailPage /></RequiresPermission>} />
        <Route path="/quotes/:id/edit" element={<RequiresPermission permission="quote.update"><QuoteFormPage /></RequiresPermission>} />
        <Route path="/payments" element={<RequiresPermission permission="payment.read"><PaymentsPage /></RequiresPermission>} />
        <Route path="/payments/new" element={<RequiresPermission permission="payment.create"><PaymentFormModal /></RequiresPermission>} />
        <Route path="/clients" element={<RequiresPermission permission="client.read"><ClientsPage /></RequiresPermission>} />
        <Route path="/clients/:id" element={<RequiresPermission permission="client.read"><ClientsPage /></RequiresPermission>} />
        <Route path="/products" element={<RequiresPermission permission="product.read"><ProductsPage /></RequiresPermission>} />
        <Route path="/taxes" element={<RequiresPermission permission="tax.read"><TaxesPage /></RequiresPermission>} />
        <Route path="/expenses" element={<RequiresPermission permission="expense.read"><ExpensesPage /></RequiresPermission>} />
        <Route path="/reports" element={<RequiresPermission permission="report.read"><ReportsPage /></RequiresPermission>} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings/users" element={<RequiresPermission permission="user.read"><UsersPage /></RequiresPermission>} />
        <Route path="/settings/roles" element={<RequiresPermission permission="role.read"><RolesPage /></RequiresPermission>} />
        <Route path="/settings/company" element={<CompanySettingsPage />} />
        <Route path="/settings/audit" element={<RequiresPermission permission="audit.read"><AuditPage /></RequiresPermission>} />
        <Route path="/settings/system" element={<RequiresPermission permission="system.manage"><SystemSettingsPage /></RequiresPermission>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}