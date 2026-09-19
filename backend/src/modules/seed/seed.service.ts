import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { Role } from '../roles/schemas/role.schema';
import { ROLE_DEFINITIONS, ROLE_KEYS } from '../roles/permissions.constants';
import { Company } from '../company/schemas/company.schema';
import { SystemConfig, SYSTEM_CONFIG_ID } from '../system/schemas/system-config.schema';
import { User } from '../users/schemas/user.schema';
import { Client } from '../clients/schemas/client.schema';
import { Product } from '../products/schemas/product.schema';
import { Tax } from '../taxes/schemas/tax.schema';
import { Invoice, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { Quote, QuoteStatus } from '../quotes/schemas/quote.schema';
import { Payment } from '../payments/schemas/payment.schema';
import { Expense } from '../expenses/schemas/expense.schema';
import { AppNotification } from '../notifications/schemas/notification.schema';
import { computeTotals } from '../../common/utils/totals.util';
import { round2 } from '../../common/utils/money.util';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Seed');

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    @InjectModel(Company.name) private readonly companyModel: Model<Company>,
    @InjectModel(SystemConfig.name) private readonly systemModel: Model<SystemConfig>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Client.name) private readonly clientModel: Model<Client>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Tax.name) private readonly taxModel: Model<Tax>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(Quote.name) private readonly quoteModel: Model<Quote>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    @InjectModel(AppNotification.name) private readonly notificationModel: Model<AppNotification>,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.seedAll();
    } catch (error) {
      this.logger.error(
        `Seed failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async seedAll() {
    const withDemo = this.configService.get<string>('SEED_DEMO_DATA') !== 'false';
    const adminPassword =
      this.configService.get<string>('SEED_ADMIN_PASSWORD') || 'Admin123!';

    await this.seedRoles();
    await this.seedCompany();
    await this.seedSystemConfig();
    await this.seedUsers(adminPassword);
    if (withDemo) await this.seedDemoData();

    this.logger.log(`Seeding complete (demo data: ${withDemo})`);
  }

  private async seedRoles(): Promise<void> {
    for (const def of ROLE_DEFINITIONS) {
      const exists = await this.roleModel.findOne({ key: def.key }).lean().exec();
      if (!exists) await this.roleModel.create(def);
    }
  }

  private async seedCompany(): Promise<void> {
    const company = await this.companyModel.findOne().lean().exec();
    if (!company) {
      await this.companyModel.create({
        key: 'company-primary',
        name: 'Acme Landing Solutions Ltd.',
        legalName: 'Acme Landing Solutions Ltd.',
        email: 'billing@acmelanding.com',
        phone: '+1 (555) 010-2030',
        website: 'https://www.acmelanding.com',
        address: {
          line1: '100 Harbor Drive',
          line2: '',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105',
          country: 'US',
        },
        currency: 'USD',
        invoicePrefix: 'INV',
        invoiceNextNumber: 1,
        quotePrefix: 'QT',
        quoteNextNumber: 1,
        paymentPrefix: 'PAY',
        paymentNextNumber: 1,
        taxLabel: 'VAT',
        defaultPaymentTermsDays: 14,
        footerNote: 'Thank you for your business.',
        logoUrl: '',
      });
    }
  }

  private async seedSystemConfig(): Promise<void> {
    const config = await this.systemModel.findOne().lean().exec();
    if (!config) {
      await this.systemModel.create({
        key: SYSTEM_CONFIG_ID,
        appName: 'Ledgerly',
        signupsEnabled: true,
        maintenanceMode: false,
        footerCompanyName: 'Ledgerly by RBAS TechLabs',
        supportEmail: 'support@ledgerly.dev',
      });
    }
  }

  private async seedUsers(adminPassword: string): Promise<void> {
    if (await this.userModel.countDocuments()) return;
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    const adminDoc = await this.userModel.findOne({ role: 'admin' }).lean().exec();
    const definitions: { email: string; name: string; role: string }[] = [
      { email: 'superadmin@ledgerly.dev', name: 'System Owner', role: ROLE_KEYS.SUPER_ADMIN },
      { email: 'admin@ledgerly.dev', name: 'Alex Morgan', role: ROLE_KEYS.ADMIN },
      { email: 'manager@ledgerly.dev', name: 'Jamie Carter', role: ROLE_KEYS.MANAGER },
      { email: 'accountant@ledgerly.dev', name: 'Priya Sharma', role: ROLE_KEYS.ACCOUNTANT },
      { email: 'viewer@ledgerly.dev', name: 'Robin Lee', role: ROLE_KEYS.VIEWER },
    ];
    for (const def of definitions) {
      await this.userModel.create({
        name: def.name,
        email: def.email,
        passwordHash,
        role: def.role,
        status: 'active',
        emailVerified: true,
        createdBy: adminDoc?._id ?? null,
        lastLoginAt: null,
      });
    }
  }

  private async seedDemoData(): Promise<void> {
    await this.seedTaxes();
    await this.seedClients();
    await this.seedProducts();
    await this.seedInvoices();
    await this.seedQuotes();
    await this.seedPayments();
    await this.seedExpenses();
    await this.seedNotifications();
  }

  private async seedTaxes(): Promise<void> {
    if (await this.taxModel.countDocuments()) return;
    await this.taxModel.insertMany([
      { name: 'No Tax', rate: 0, isDefault: false, isActive: true },
      { name: 'VAT 5%', rate: 5, isDefault: false, isActive: true },
      { name: 'VAT 20%', rate: 20, isDefault: true, isActive: true },
    ]);
  }

  private async seedClients(): Promise<void> {
    if (await this.clientModel.countDocuments()) return;
    const cities = [
      ['Northwind Traders', 'finance@northwind.io', 'Seattle'],
      ['BluePeak Logistics', 'accounts@bluepeak.co', 'Chicago'],
      ['Helios Retail Group', 'ap@heliosretail.com', 'Austin'],
      ['Cascade Consulting', 'billing@cascade.consulting', 'Denver'],
      ['Orchard & Co', 'payables@orchardco.com', 'Portland'],
      ['Vertex Studios', 'invoices@vertex.studio', 'Los Angeles'],
      ['Stonebridge Health', 'finance@stonebridge.health', 'Boston'],
      ['Fjord Software', 'billing@fjord.software', 'New York'],
      ['Meadow Foods', 'payables@meadowfoods.com', 'Boise'],
      ['Ironmark Industrial', 'ap@ironmark.ind', 'Detroit'],
    ];
    await this.clientModel.insertMany(
      cities.map(([name, email, city], i) => ({
        name,
        email,
        phone: `+1 (555) 01${String(i).padStart(2, '0')}-${1000 + i * 777}`,
        website: `https://www.${String(name).toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        taxId: `TAX-${1000 + i * 37}`,
        address: { line1: `${100 + i * 40} Market Street`, city, state: 'CA', zip: `${90000 + i * 100}`, country: 'US' },
        status: 'active',
      })),
    );
  }

  private async seedProducts(): Promise<void> {
    if (await this.productModel.countDocuments()) return;
    const defaultTax = await this.taxModel.findOne({ isDefault: true }).lean().exec();
    const products: { name: string; sku: string; category: string; unitPrice: number }[] = [
      { name: 'Platform license', sku: 'PLAT-PRO', category: 'Subscription', unitPrice: 99 },
      { name: 'Onboarding package', sku: 'SVC-ONB', category: 'Service', unitPrice: 450 },
      { name: 'Consulting (per hour)', sku: 'SVC-CON', category: 'Service', unitPrice: 120 },
      { name: 'Dedicated support tier', sku: 'PLAT-SUP', category: 'Subscription', unitPrice: 250 },
      { name: 'Infrastructure add-on', sku: 'ADDN-INF', category: 'Add-on', unitPrice: 75 },
      { name: 'Training workshop', sku: 'SVC-TRN', category: 'Service', unitPrice: 600 },
      { name: 'Integration setup', sku: 'SVC-INT', category: 'Service', unitPrice: 350 },
      { name: 'SSO / security module', sku: 'ADDN-SSO', category: 'Add-on', unitPrice: 40 },
    ];
    await this.productModel.insertMany(
      products.map((p) => ({
        ...p,
        description: `${p.name} for the Ledgerly platform`,
        taxId: defaultTax?._id ?? null,
        isActive: true,
      })),
    );
  }

  private async invoiceLines(i: number) {
    const products = await this.productModel.find().lean().exec();
    const role = i % 6;
    if (role === 3) {
      return [{ description: 'One-time onboarding package', quantity: 1, unitPrice: 450, taxPercent: 20 }];
    }
    if (role === 4) {
      const base = products[0];
      const addon = products[4];
      return [
        { description: base?.name ?? 'Platform license', quantity: 3 + (i % 5), unitPrice: base?.unitPrice ?? 99, taxPercent: 20 },
        { description: addon?.name ?? 'Add-on', quantity: 1, unitPrice: addon?.unitPrice ?? 75, taxPercent: 20 },
      ];
    }
    const p = products[i % products.length];
    return [{ description: p?.name ?? 'Professional service', quantity: 1, unitPrice: p?.unitPrice ?? 100, taxPercent: 20 }];
  }

  private async seedInvoices(): Promise<void> {
    if (await this.invoiceModel.countDocuments()) return;
    const clients = await this.clientModel.find().lean().exec();
    const company = await this.companyModel.findOne().lean().exec();
    const today = new Date();
    const paidIndexes = new Set([6, 7, 8, 10, 11, 12, 14, 16, 17, 18, 19, 22, 23, 24, 27]);
    const partialIndexes = new Set([3, 9, 13, 25]);
    const voidIndexes = new Set([20]);
    const draftIndexes = new Set([26]);

    for (let i = 0; i < 28; i++) {
      const client = clients[i % clients.length];
      const invoiceNumber = await this.nextNumber('invoice');
      const issueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 3 - (i % 7));
      const dueDate = new Date(issueDate.getTime() + 14 * 86400000);
      const computed = computeTotals(await this.invoiceLines(i));

      let status: InvoiceStatus = 'sent';
      if (paidIndexes.has(i)) status = 'paid';
      else if (partialIndexes.has(i)) status = 'partial';
      else if (voidIndexes.has(i)) status = 'void';
      else if (draftIndexes.has(i)) status = 'draft';

      const amountPaid =
        status === 'paid' || status === 'partial'
          ? round2(computed.total * (status === 'partial' ? 0.4 : 1))
          : 0;

      await this.invoiceModel.create({
        invoiceNumber,
        clientId: client!._id,
        clientName: client!.name,
        issueDate,
        dueDate,
        status,
        items: computed.items,
        discount: { type: 'fixed', value: 0 },
        subtotal: computed.subtotal,
        discountAmount: computed.discountAmount,
        taxTotal: computed.taxTotal,
        total: computed.total,
        amountPaid,
        currency: company?.currency ?? 'USD',
        notes: '',
        terms: 'Payment due within 14 days.',
        paidAt: status === 'paid' ? new Date(issueDate.getTime() + (5 + (i % 9)) * 86400000) : null,
        sentAt: status === 'draft' ? null : new Date(issueDate.getTime() + 86400000),
        createdBy: null,
      });
    }
  }

  private async seedQuotes(): Promise<void> {
    if (await this.quoteModel.countDocuments()) return;
    const clients = await this.clientModel.find().lean().exec();
    const today = new Date();
    const statuses: QuoteStatus[] = ['sent', 'accepted', 'rejected', 'draft'];
    for (let i = 0; i < 8; i++) {
      const client = clients[i % clients.length];
      const quoteNumber = await this.nextNumber('quote');
      const issueDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 2);
      const validUntil = new Date(issueDate.getTime() + 30 * 86400000);
      const computed = computeTotals([
        { description: 'Quarterly consulting retainer', quantity: 1, unitPrice: 1500 + i * 100, taxPercent: 20 },
      ]);
      await this.quoteModel.create({
        quoteNumber,
        clientId: client!._id,
        clientName: client!.name,
        issueDate,
        validUntil,
        status: statuses[i % statuses.length],
        items: computed.items,
        discount: { type: 'fixed', value: 0 },
        subtotal: computed.subtotal,
        discountAmount: computed.discountAmount,
        taxTotal: computed.taxTotal,
        total: computed.total,
        currency: 'USD',
        notes: '',
        terms: 'Valid for 30 days.',
        createdBy: null,
      });
    }
  }

  private async seedPayments(): Promise<void> {
    if (await this.paymentModel.countDocuments()) return;
    const invoices = await this.invoiceModel
      .find({ status: { $in: ['paid', 'partial'] }, paidAt: { $ne: null } })
      .lean()
      .exec();
    const methods = ['card', 'bank', 'cash', 'other'] as const;
    for (const invoice of invoices) {
      const amount = round2(invoice.amountPaid);
      if (amount <= 0) continue;
      const paymentNumber = await this.nextNumber('payment');
      await this.paymentModel.create({
        paymentNumber,
        invoiceId: invoice._id,
        clientId: invoice.clientId,
        clientName: invoice.clientName,
        amount,
        method: methods[invoice.amountPaid % methods.length],
        reference: `TXN-${Math.floor(10000000 + Math.random() * 90000000)}`,
        paidAt: invoice.paidAt ?? new Date(),
        note: '',
        status: 'completed',
        createdBy: null,
      });
    }
  }

  private async seedExpenses(): Promise<void> {
    if (await this.expenseModel.countDocuments()) return;
    const today = new Date();
    const expenses = [
      ['Software', 'Cloud Infrastructure', 320],
      ['Office', 'Urban Office Supplies', 85],
      ['Travel', 'Airline tickets', 640],
      ['Marketing', 'Ad network spend', 450],
      ['Equipment', 'Laptop purchase', 1299],
      ['Software', 'Team collaboration tool', 40],
      ['Utilities', 'Electricity and internet', 210],
      ['Legal', 'External counsel', 500],
    ] as const;
    await this.expenseModel.insertMany(
      expenses.map(([category, vendor, amount], i) => ({
        category,
        vendor,
        amount,
        expenseDate: new Date(today.getFullYear(), today.getMonth(), -i * 4),
        method: i % 2 === 0 ? 'card' : 'bank',
        status: ['pending', 'approved', 'approved', 'rejected'][i % 4],
        note: '',
        createdBy: null,
      })),
    );
  }

  private async seedNotifications(): Promise<void> {
    if (await this.notificationModel.countDocuments()) return;
    const admin = await this.userModel.findOne({ role: 'admin' }).select('_id').lean().exec();
    if (!admin) return;
    const messages = [
      { type: 'system', title: 'Welcome to Ledgerly', body: 'Complete your workspace setup to get started.' },
      { type: 'system', title: 'Demo data ready', body: 'Explore invoices, payments, clients and reports.' },
      { type: 'invoice', title: 'Set up payment terms', body: 'Configure your default payment terms in Company settings.' },
    ] as const;
    await this.notificationModel.insertMany(
      messages.map((m) => ({
        userId: admin._id,
        type: m.type,
        title: m.title,
        body: m.body,
        readAt: null,
      })),
    );
  }

  private async nextNumber(type: 'invoice' | 'quote' | 'payment'): Promise<string> {
    const company = await this.companyModel
      .findOneAndUpdate({}, { $inc: { [`${type}NextNumber`]: 1 } }, { new: true })
      .exec();
    const doc = (company ?? ({} as never)) as unknown as Record<string, unknown>;
    const prefix = (doc[`${type}Prefix`] as string) ?? '';
    const seq = Number(doc[`${type}NextNumber`]) - 1;
    return `${prefix}-${String(seq).padStart(5, '0')}`;
  }
}