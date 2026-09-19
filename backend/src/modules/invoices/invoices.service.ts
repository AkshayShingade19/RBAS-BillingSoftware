import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceStatus } from './schemas/invoice.schema';
import { Client } from '../clients/schemas/client.schema';
import { Product } from '../products/schemas/product.schema';
import { Tax } from '../taxes/schemas/tax.schema';
import { CompanyService } from '../company/company.service';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { Paginated, makePaginated } from '../../common/dto/pagination.dto';
import { toCsv } from '../../common/utils/csv.util';
import { computeTotals, LineItemResult } from '../../common/utils/totals.util';
import { CreateInvoiceDto, UpdateInvoiceDto } from './dto/invoice.dto';

export interface InvoiceQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  clientId?: string;
  from?: string;
  to?: string;
  sort?: string;
}

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(Client.name) private readonly clientModel: Model<Client>,
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Tax.name) private readonly taxModel: Model<Tax>,
    private readonly companyService: CompanyService,
    private readonly auditService: AuditService,
  ) {}

  async applyOverdueSweep(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.invoiceModel.updateMany(
      { status: { $in: ['sent', 'partial'] }, dueDate: { $lt: today } },
      { $set: { status: 'overdue' } },
    ).exec();
  }

  async list(query: InvoiceQuery): Promise<Paginated<Record<string, unknown>>> {
    await this.applyOverdueSweep();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const filter: Record<string, unknown> = {};
    if (query.status && query.status !== 'all') filter.status = query.status;
    if (query.clientId && Types.ObjectId.isValid(query.clientId)) {
      filter.clientId = new Types.ObjectId(query.clientId);
    }
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ invoiceNumber: rx }, { clientName: rx }];
    }
    if (query.from || query.to) {
      filter.issueDate = {};
      if (query.from) (filter.issueDate as Record<string, unknown>).$gte = new Date(query.from);
      if (query.to) (filter.issueDate as Record<string, unknown>).$lte = new Date(query.to);
    }

    const sort = this.parseSort(query.sort);
    const [data, total] = await Promise.all([
      this.invoiceModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.invoiceModel.countDocuments(filter).exec(),
    ]);

    const enriched = data.map((inv) => ({
      ...inv,
      id: String(inv._id),
      clientId: String(inv.clientId),
      discount: inv.discount ?? { type: 'fixed', value: 0 },
      balanceDue: Math.max(0, Number(inv.total) - Number(inv.amountPaid)),
    }));
    return makePaginated(enriched, page, limit, total);
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Invoice not found');
    const invoice = await this.invoiceModel.findById(id).lean().exec();
    if (!invoice) throw new NotFoundException('Invoice not found');
    return {
      ...invoice,
      id: String(invoice._id),
      clientId: String(invoice.clientId),
      balanceDue: Math.max(0, Number(invoice.total) - Number(invoice.amountPaid)),
    };
  }

  async create(dto: CreateInvoiceDto, actor: JwtUser) {
    const client = await this.clientModel.findById(dto.clientId).lean().exec();
    if (!client) throw new NotFoundException('Client not found');

    const company = await this.companyService.get();
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const terms = dto.terms || String(company.defaultPaymentTermsDays || 0);
    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : new Date(issueDate.getTime() + (company.defaultPaymentTermsDays || 14) * 86400000);

    const invoiceNumber = await this.companyService.nextNumber('invoice');
    const computed = this.buildComputed(dto);

    const invoice = await this.invoiceModel.create({
      invoiceNumber,
      clientId: new Types.ObjectId(dto.clientId),
      clientName: client.name,
      issueDate,
      dueDate,
      status: 'draft',
      items: computed.items,
      discount: computed.discount,
      subtotal: computed.subtotal,
      discountAmount: computed.discountAmount,
      taxTotal: computed.taxTotal,
      total: computed.total,
      amountPaid: 0,
      currency: dto.currency || company.currency,
      notes: dto.notes ?? '',
      terms,
      createdBy: new Types.ObjectId(actor.id),
    });

    await this.auditService.record({
      action: 'invoice.create',
      entityType: 'Invoice',
      entityId: String(invoice._id),
      description: `Created invoice ${invoice.invoiceNumber} for ${client.name}`,
      actor,
    });
    return this.findById(String(invoice._id));
  }

  async update(id: string, dto: UpdateInvoiceDto, actor: JwtUser) {
    const invoice = await this.requireEditable(id);
    if (invoice.status !== 'draft') {
      throw new BadRequestException('Only draft invoices can be edited');
    }

    const patch: Record<string, unknown> = {};
    if (dto.clientId !== undefined) {
      const client = await this.clientModel.findById(dto.clientId).lean().exec();
      if (!client) throw new NotFoundException('Client not found');
      patch.clientId = new Types.ObjectId(dto.clientId);
      patch.clientName = client.name;
    }
    if (dto.issueDate) {
      const issueDate = new Date(dto.issueDate);
      patch.issueDate = issueDate;
      if (!dto.dueDate) {
        patch.dueDate = new Date(issueDate.getTime() + 30 * 86400000);
      }
    }
    if (dto.dueDate) patch.dueDate = new Date(dto.dueDate);
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (dto.terms !== undefined) patch.terms = dto.terms;

    const merge: Record<string, unknown> = { ...invoice, ...patch };
    const computed = this.buildComputed(merge as unknown as CreateInvoiceDto);
    patch.items = computed.items;
    patch.discount = computed.discount;
    patch.subtotal = computed.subtotal;
    patch.discountAmount = computed.discountAmount;
    patch.taxTotal = computed.taxTotal;
    patch.total = computed.total;

    await this.invoiceModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec();
    await this.auditService.record({
      action: 'invoice.update',
      entityType: 'Invoice',
      entityId: id,
      description: `Updated invoice ${invoice.invoiceNumber}`,
      actor,
    });
    return this.findById(id);
  }

  async send(id: string, actor: JwtUser) {
    const invoice = await this.requireExists(id);
    if (invoice.status !== 'draft') {
      throw new BadRequestException('Only draft invoices can be sent');
    }
    await this.invoiceModel.findByIdAndUpdate(id, {
      $set: { status: 'sent', sentAt: new Date() },
    }).exec();
    await this.auditService.record({
      action: 'invoice.send',
      entityType: 'Invoice',
      entityId: id,
      description: `Sent invoice ${invoice.invoiceNumber}`,
      actor,
    });
    return this.findById(id);
  }

  async markPaid(id: string, actor: JwtUser) {
    const invoice = await this.requireExists(id);
    if (invoice.status === 'void' || invoice.status === 'paid') {
      throw new BadRequestException(`Invoice is ${invoice.status}`);
    }
    await this.invoiceModel.findByIdAndUpdate(id, {
      $set: { status: 'paid', amountPaid: invoice.total, paidAt: new Date() },
    }).exec();
    await this.auditService.record({
      action: 'invoice.mark-paid',
      entityType: 'Invoice',
      entityId: id,
      description: `Marked invoice ${invoice.invoiceNumber} as paid`,
      actor,
    });
    return this.findById(id);
  }

  async void(id: string, actor: JwtUser, reason?: string) {
    const invoice = await this.requireExists(id);
    if (invoice.status === 'void') throw new BadRequestException('Invoice already void');
    if (invoice.status === 'paid') throw new BadRequestException('Paid invoices cannot be voided');
    if (invoice.amountPaid > 0) {
      throw new BadRequestException('Invoices with payments cannot be voided');
    }
    await this.invoiceModel.findByIdAndUpdate(id, {
      $set: {
        status: 'void',
        voidedBy: new Types.ObjectId(actor.id),
        voidedAt: new Date(),
        voidReason: reason ?? '',
      },
    }).exec();
    await this.auditService.record({
      action: 'invoice.void',
      entityType: 'Invoice',
      entityId: id,
      description: `Voided invoice ${invoice.invoiceNumber}`,
      metadata: { reason },
      actor,
    });
    return this.findById(id);
  }

  async applyPayment(invoiceId: string, amount: number): Promise<void> {
    const invoice = await this.requireExists(invoiceId);
    if (invoice.status === 'void') throw new BadRequestException('Cannot pay a voided invoice');
    if (invoice.status === 'paid') throw new BadRequestException('Invoice already paid');
    const balance = Number(invoice.total) - Number(invoice.amountPaid);
    if (amount > balance + 0.001) {
      throw new BadRequestException(
        `Payment exceeds remaining balance of ${balance.toFixed(2)}`,
      );
    }
    const amountPaid = Math.min(Number(invoice.total), Number(invoice.amountPaid) + amount);
    const status: InvoiceStatus =
      amountPaid + 0.001 >= Number(invoice.total) ? 'paid' : 'partial';
    await this.invoiceModel.findByIdAndUpdate(invoiceId, {
      $set: { amountPaid, status, paidAt: status === 'paid' ? new Date() : invoice.paidAt ?? null },
    }).exec();
  }

  async rollbackPayment(invoiceId: string, amount: number): Promise<void> {
    const invoice = await this.requireExists(invoiceId);
    const amountPaid = Math.max(0, Number(invoice.amountPaid) - amount);
    const status: InvoiceStatus =
      amountPaid <= 0
        ? 'sent'
        : amountPaid + 0.001 >= Number(invoice.total)
          ? 'paid'
          : 'partial';
    await this.invoiceModel.findByIdAndUpdate(invoiceId, {
      $set: { amountPaid, status, paidAt: status === 'paid' ? invoice.paidAt ?? null : null },
    }).exec();
  }

  async remove(id: string, actor: JwtUser) {
    const invoice = await this.requireExists(id);
    if (invoice.status !== 'draft') {
      throw new BadRequestException('Only draft invoices can be deleted');
    }
    await this.invoiceModel.deleteOne({ _id: id }).exec();
    await this.auditService.record({
      action: 'invoice.delete',
      entityType: 'Invoice',
      entityId: id,
      description: `Deleted draft invoice ${invoice.invoiceNumber}`,
      actor,
    });
    return { message: 'Invoice deleted' };
  }

  async toCsv(query: InvoiceQuery): Promise<string> {
    const result = await this.list({ ...query, page: 1, limit: 100 });
    const rows = result.data.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      client: inv.clientName,
      issueDate: (inv.issueDate as Date).toISOString().slice(0, 10),
      dueDate: (inv.dueDate as Date).toISOString().slice(0, 10),
      status: inv.status,
      subtotal: inv.subtotal,
      taxTotal: inv.taxTotal,
      total: inv.total,
      amountPaid: inv.amountPaid,
      balanceDue: Number(inv.total) - Number(inv.amountPaid),
    }));
    return toCsv(rows);
  }

  async dashboardStats() {
    await this.applyOverdueSweep();
    const yearStart = new Date(new Date().getFullYear(), 0, 1);

    const [paidAgg, openAgg, recent, statusAgg, monthlyAgg] = await Promise.all([
      this.invoiceModel.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]).exec(),
      this.invoiceModel.aggregate([
        { $match: { status: { $in: ['partial', 'sent', 'overdue'] } } },
        { $group: { _id: null, total: { $sum: { $subtract: ['$total', '$amountPaid'] } } } },
      ]).exec(),
      this.invoiceModel.find().sort({ createdAt: -1 }).limit(6).lean().exec(),
      this.invoiceModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]).exec(),
      this.invoiceModel.aggregate([
        {
          $match: {
            status: { $nin: ['void', 'draft'] },
            issueDate: { $gte: yearStart },
          },
        },
        {
          $group: {
            _id: { $month: '$issueDate' },
            revenue: { $sum: '$total' },
          },
        },
        { $sort: { _id: 1 } },
      ]).exec(),
    ]);

    const paid = paidAgg[0]?.total ?? 0;
    const outstanding = openAgg[0]?.total ?? 0;

    const statusCounts: Record<string, number> = {};
    for (const s of statusAgg) statusCounts[s._id] = s.count;

    const monthly = Array.from({ length: 12 }, (_, i) => {
      const found = monthlyAgg.find((m) => m._id === i + 1);
      return { month: i + 1, revenue: found?.revenue ?? 0 };
    });

    return {
      paid,
      outstanding,
      statusCounts,
      recentInvoices: recent.map((inv) => ({
        id: String(inv._id),
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.clientName,
        total: inv.total,
        status: inv.status,
        createdAt: inv.createdAt,
      })),
      monthlyRevenue: monthly,
    };
  }

  private buildComputed(dto: CreateInvoiceDto) {
    const items = (dto.items ?? []).map((it) => ({
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      taxPercent: Number(it.taxPercent ?? 0),
    }));
    const discount = dto.discount ?? { type: 'fixed' as const, value: 0 };
    const computed = computeTotals(items, discount);
    return {
      items: computed.items as LineItemResult[],
      discount,
      subtotal: computed.subtotal,
      discountAmount: computed.discountAmount,
      taxTotal: computed.taxTotal,
      total: computed.total,
    };
  }

private async requireExists(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Invoice not found');
    const invoice = await this.invoiceModel.findById(id).lean().exec();
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private async requireEditable(id: string) {
    return this.requireExists(id);
  }

  private parseSort(sort?: string): Record<string, 1 | -1> {
    if (!sort) return { createdAt: -1 };
    const [field, dir] = sort.split(':');
    const allowed = ['invoiceNumber', 'clientName', 'issueDate', 'dueDate', 'total', 'status', 'createdAt'];
    if (!allowed.includes(field)) return { createdAt: -1 };
    return { [field]: dir === 'asc' ? 1 : -1 };
  }
}