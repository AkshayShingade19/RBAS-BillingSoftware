export interface JwtUser {
  id: string;
  email: string;
  role: string;
  name: string;
  status: string;
  emailVerified: boolean;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  tokens: AuthTokens;
  user: JwtUser;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Address {
  line1?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface Client {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  address?: Address;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Tax {
  _id: string;
  name: string;
  rate: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
}

export interface Product {
  _id: string;
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  unitPrice: number;
  taxId?: string | null;
  isActive: boolean;
  tax?: Pick<Tax, '_id' | 'name' | 'rate'> | null;
  createdAt: string;
}

export interface LineItem {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercent: number;
  amount: number;
  taxAmount: number;
}

export interface Discount {
  type: 'percent' | 'fixed';
  value: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void';

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  items: LineItem[];
  discount: Discount;
  subtotal: number;
  discountAmount: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  notes?: string;
  terms?: string;
  sentAt?: string | null;
  paidAt?: string | null;
  voidReason?: string;
  createdAt: string;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

export interface Quote extends Omit<Invoice, 'status' | 'invoiceNumber' | 'dueDate' | 'amountPaid' | 'balanceDue'> {
  quoteNumber: string;
  validUntil: string;
  status: QuoteStatus;
  convertedToInvoiceId?: string | null;
}

export type PaymentMethod = 'card' | 'bank' | 'cash' | 'other';

export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  clientId?: string | null;
  clientName: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
  status: 'completed' | 'voided';
  paidAt: string;
  createdAt: string;
}

export interface Expense {
  _id: string;
  category: string;
  vendor?: string;
  amount: number;
  expenseDate: string;
  method: string;
  status: string;
  note?: string;
  createdAt: string;
}

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  body?: string;
  readAt?: string | null;
  createdAt: string;
}

export interface Company {
  key: string;
  name: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  address?: Address;
  currency: string;
  invoicePrefix: string;
  invoiceNextNumber: number;
  quotePrefix: string;
  quoteNextNumber: number;
  paymentPrefix: string;
  paymentNextNumber: number;
  taxLabel: string;
  defaultPaymentTermsDays: number;
  footerNote: string;
  logoUrl: string;
}

export interface Role {
  key: string;
  name: string;
  description: string;
  permissions: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'pending' | 'active' | 'suspended';
  emailVerified: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export interface AuditLog {
  _id: string;
  actorId?: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string;
  description: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface SystemConfig {
  appName: string;
  signupsEnabled: boolean;
  maintenanceMode: boolean;
  footerCompanyName: string;
  supportEmail: string;
}

export interface RevenueReport {
  from: string;
  to: string;
  paymentsReceived: number;
  paymentCount: number;
  invoiced: number;
  expenses: number;
  net: number;
  byMonth: { year: number; month: number; sum: number; count: number }[];
  byMethod: { method: string; sum: number }[];
}

export interface InvoiceStatusReport {
  status: string;
  count: number;
  total: number;
  paid: number;
  balance: number;
}

export interface TopClientReport {
  client: string;
  count: number;
  invoiced: number;
  paid: number;
  balance: number;
  share: number;
}

export interface OverdueAgingReport {
  label: string;
  count: number;
  total: number;
}

export interface TaxSummaryReport {
  period: string;
  subtotal: number;
  taxTotal: number;
  percent: number;
}

export interface DashboardData {
  revenue: RevenueReport;
  expenses: number;
  recentPayments: { id: string; paymentNumber: string; clientName: string; amount: number; paidAt: string }[];
  overdueCount: number;
}

export interface SearchResult {
  clients: { id: string; name: string; email?: string; type: string }[];
  products: { id: string; name: string; sku?: string; type: string }[];
  invoices: { id: string; number: string; clientName: string; status: string; type: string }[];
  quotes: { id: string; number: string; clientName: string; status: string; type: string }[];
  payments: { id: string; number: string; clientName: string; type: string }[];
}