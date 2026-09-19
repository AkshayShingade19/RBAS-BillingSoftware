# Ledgerly — Product Specification

**Product:** Ledgerly
**Brand:** RBAS TechLabs
**Type:** Billing & Payments SaaS for small-to-mid businesses
**Tagline:** "Billing that works as hard as you do."

Ledgerly is an original product designed and engineered by RBAS TechLabs.
It is a full billing/ERP-style platform covering the customer → quote →
invoice → payment lifecycle, with client management, catalogue management,
expense tracking, reports, role-based administration, and a notification
center. All functionality is original work; it does not replicate the source
code, branding, or visual design of any third-party application.

---

## 1. Users & Roles

| Role | Description |
|------|-------------|
| `super_admin` | Platform owner. Full access to every module plus system configuration, audit logs, and user management across the workspace. Intended for RBAS TechLabs platform operators. |
| `admin` | Workspace administrator. Manages users, roles/permissions, company settings, reports, notifications, and all financial data. |
| `manager` | Can manage clients, quotes, invoices, payments, expenses, products, taxes, and view reports. Cannot delete records or change system settings. |
| `accountant` | Handles invoicing, payments, expenses, and reports. Read-only on clients/catalogue administration. |
| `viewer` | Read-only access across all modules. Cannot create, edit, delete, or export sensitive financial data. |

### Permission model
Permissions are stored per role as a flat set of strings grouped by resource:

```
<resource>.<action>   e.g.  invoice.create / invoice.read / invoice.update / invoice.delete
```

Seeded resources: `dashboard`, `client`, `product`, `tax`, `quote`, `invoice`,
`payment`, `expense`, `report`, `user`, `role`, `notification`,
`audit`, `settings`, `company`.

Actions: `create`, `read`, `update`, `delete`, `manage`, `export`.

**Critical permissions are enforced server-side** in guards; the UI uses the
same permission set to show/hide actions.

---

## 2. Feature / Module breakdown

### 2.1 Authentication (`/auth`)
- Sign up (creates a `pending` user, requires email+password, sends verification).
- Login / Logout.
- Email/OTP verification (purpose: `email_verify`, `password_reset`).
- Forgot password → OTP → reset password.
- Access + refresh token flow with rotation and server-side refresh-token/session storage.
- Session list (see active sessions, revoke a session).
- Rate limiting on auth endpoints.
- JWT `access_token` (short-lived) + `refresh_token` (rotated, stored hashed).

### 2.2 User Management (`/users`)
- Get/update own profile, change password, edit name/avatar/ui preferences.
- `admin`/`super_admin`: list users (search, filter by role/status, paginate),
  invite user, activate/suspend, change role, delete (soft-guarded), view audit of user.
- User statuses: `pending`, `active`, `suspended`.

### 2.3 Dashboard (role-aware)
- Stat cards: revenue (paid), outstanding, overdue, open quotes.
- Charts: revenue by month (12 months), invoice status distribution.
- Recent invoices, recent payments, recent activity, notifications, quick actions.
- Metrics scale with role (viewer sees read-only summary; accountant sees finance; admin sees full).

### 2.4 Clients (`/clients`)
- Fields: name, email, phone, website, taxId, billing details, status.
- List with search/filter/sort/pagination and CSV export.
- Client detail: contact info + summary stats (total invoiced, paid, outstanding) +
  linked invoices list.

### 2.5 Products / Services (`/products`)
- Fields: name, sku, description, category, unitPrice, tax rate, active flag.
- List with search/filter/sort/pagination, CSV export.

### 2.6 Taxes (`/taxes`)
- Fields: name, rate, isDefault, active, compound.
- Used by invoice & quote line items.

### 2.7 Quotes (`/quotes`)
- Quote number auto-generated from company prefix rules.
- Multi line-items (product or freeform description), unit price, qty, tax, discount.
- Status flow: `draft → sent → accepted | rejected | expired`, plus `converted`.
- Convert quote → invoice (copies line items/totals) in one action.
- CSV export on list.

### 2.8 Invoices (`/invoices`) — core workflow
- Auto invoice numbering per sequence config.
- Line items with product link or freeform line, qty, unitPrice, taxPercent.
- Discount (percent or fixed) on subtotal.
- Totals: subtotal, discountAmount, taxTotal, total, amountPaid, balanceDue.
- Status flow: `draft → sent → partial → paid`, derived `overdue`, manual `void`.
- Actions: create, edit (only draft), send (mark sent), record payment, void,
  mark as paid. Numbering never re-uses; voided records retained.
- Invoice detail view with print-ready document layout.
- CSV export with pagination/filter state.

### 2.9 Payments (`/payments`)
- Record payment against an invoice; supports partial payments; updates invoice
  amounts atomically.
- Fields: invoice, amount, method (card/bank/cash/other), reference, paid date, note.
- Payment number auto-generated.
- List with filters (invoice/staff/date range), CSV export.

### 2.10 Expenses (`/expenses`)
- Fields: category, vendor, amount, expense date, payment method, status, note.
- List with search/filter, CSV export.

### 2.11 Reports & Analytics (`/reports`)
- Revenue by period (day/month/custom range) with totals.
- Invoice status breakdown.
- Top clients by revenue.
- Overdue aging buckets (1–30, 31–60, 61–90, 90+).
- Tax collected summary.
- CSV export of any report dataset.

### 2.12 Notifications (`/notifications`)
- In-app notifications: unread badge, mark read, mark all read, history.
- System alerts (e.g., login from new device, invoice overdue, payment received).
- Outbox architecture allows email/SMS/push later; current transport = console/log.
- Admin can send broadcast announcements.

### 2.13 Company / Settings (`/company`)
- Business identity: name, legal name, email, phone, address, website, logo URL.
- Billing config: currency, invoice prefix + next number, quote prefix + next number,
  tax label, default payment terms (days), default due day.
- Notification preferences (which events create notifications).

### 2.14 Audit Logs (`/audit`)
- Immutable append-only log of sensitive actions: auth events, user role changes,
  record creation/deletion/status changes, settings changes.
- Filter by actor, entity, action, date range; pagination.

### 2.15 Administration (`/admin`)
- Users management, roles & permissions editor (matrix), audit logs, notifications
  broadcast, company settings, platform/system configuration (super_admin only).

### 2.16 Cross-cutting features
- Global search across clients/products/invoices/numbers.
- Every list: search + filters + sorting + pagination + CSV export.
- Loading skeletons, empty states, inline validation, toasts, confirm dialogs.
- Responsive layouts: desktop sidebar → mobile drawer; tables become scrollable/cards.

---

## 3. Navigation map

### App shell (authenticated)
- Dashboard
- Billing: Invoices, Payments, Quotes, Expenses
- CRM & Catalogue: Clients, Products, Taxes
- Reports & Analytics
- Notifications (bell + page)
- Account: Profile, Account Settings, Security (sessions)

### Admin panel (role-gated)
- Users, Roles & Permissions, Audit Logs, Notifications (broadcast),
  Company Settings, System Configuration (super_admin)

### Auth pages
- Login, Sign up, Forgot password, Reset password, Verify email

---

## 4. Core workflows

1. **Quote → Invoice → Payment**
   Create quote → send → accepted → convert to invoice → send → partial payment(s)
   → paid. Every transition is audited.
2. **Direct invoice**: draft → edit → send → payment → paid. Void allowed before payment.
3. **Overdue**: scheduled/immediate derivation when dueDate < today and not paid.
4. **Onboarding**: sign up → verify email (OTP) → fill company settings → invite teammates.
5. **Admin user management**: invite → pending → activate; role assignment; suspension.

---

## 5. API surface (REST, base `/api/v1`)

| Resource | Endpoints |
|----------|-----------|
| auth | POST `/auth/signup`, POST `/auth/login`, POST `/auth/refresh`, POST `/auth/logout`, GET `/auth/sessions`, DELETE `/auth/sessions/:id`, POST `/auth/request-otp`, POST `/auth/verify-email`, POST `/auth/forgot-password`, POST `/auth/reset-password` |
| me | GET/PATCH `/me`; POST `/me/change-password` |
| users | GET/POST `/users`; GET/PATCH/DELETE `/users/:id`; POST `/users/:id/invite`; PATCH `/users/:id/status`; PATCH `/users/:id/role` |
| roles | GET `/roles`; PATCH `/roles/:id` (super_admin) |
| clients | CRUD `/clients`, GET `/clients/export` |
| products | CRUD `/products`, GET `/products/export` |
| taxes | CRUD `/taxes` |
| quotes | CRUD `/quotes`, POST `/quotes/:id/convert`, POST `/quotes/:id/status`, GET `/quotes/export` |
| invoices | CRUD `/invoices`, POST `/invoices/:id/send`, POST `/invoices/:id/void`, POST `/invoices/:id/mark-paid`, GET `/invoices/export` |
| payments | CRUD `/payments`, GET `/payments/export` |
| expenses | CRUD `/expenses`, GET `/expenses/export` |
| notifications | GET `/notifications`, PATCH `/notifications/:id/read`, POST `/notifications/read-all`, POST `/notifications/broadcast` |
| reports | GET `/reports/revenue`, GET `/reports/invoice-status`, GET `/reports/top-clients`, GET `/reports/overdue-aging`, GET `/reports/tax-summary` |
| audit | GET `/audit` |
| company | GET/PATCH `/company` |
| system | GET `/system/config`, PATCH `/system/config` (super_admin) |
| health | GET `/health` |

Standard list responses: `{ data, page, limit, total, totalPages }`.
Standard error envelope: `{ statusCode, message, error }` (NestJS default shape).

---

## 6. Database collections

`users`, `roles`, `sessions` (refresh tokens), `otps`, `clients`, `products`,
`taxes`, `quotes`, `invoices`, `payments`, `expenses`, `notifications`,
`audit_logs`, `company` (singleton), `system_config` (singleton).

Indexes: unique `email`, unique product `sku` (sparse), invoice/quote/payment
numbers, client `name`, notification `(userId, read, createdAt)`, audit
`(entityType, entityId, createdAt)`, all list keys.

---

## 7. Notifications & communication
- In-app notification center (primary, fully implemented).
- Outbox-style `MailService` interface with console transport in dev; SMTP/SMS/push
  can be plugged in without touching business logic.

## 8. Integrations (extensibility)
- CSV export everywhere (implemented).
- Webhook/API tokens, PDF generation, accounting integrations (QuickBooks/Xero),
  payment gateways (Stripe) are documented extension seams only — not built.

## 9. Security & compliance
- bcrypt password hashing, JWT access + hashed rotating refresh tokens.
- Server-side RBAC on every endpoint; DTO validation on every body.
- Helmet security headers, CORS allow-list, throttling on auth + global.
- Env-based secrets; `.env.example` provided; no secrets in code or logs.
- Audit log for sensitive admin actions; sessions revocable.