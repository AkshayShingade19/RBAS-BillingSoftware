import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Payment } from './schemas/payment.schema';
import { Invoice, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { Client } from '../clients/schemas/client.schema';
import { CompanyService } from '../company/company.service';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Paginated, makePaginated } from '../../common/dto/pagination.dto';
import { toCsv } from '../../common/utils/csv.util';
import { CreatePaymentDto, PaymentQueryDto, UpdatePaymentDto } from './dto/payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<Payment>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    @InjectModel(Client.name) private readonly clientModel: Model<Client>,
    private readonly companyService: CompanyService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(query: PaymentQueryDto): Promise<Paginated<Record<string, unknown>>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const filter: Record<string, unknown> = {};
    if (query.invoiceId && Types.ObjectId.isValid(query.invoiceId)) {
      filter.invoiceId = new Types.ObjectId(query.invoiceId);
    }
    if (query.method) filter.method = query.method;
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ paymentNumber: rx }, { clientName: rx }, { reference: rx }];
    }
    if (query.from || query.to) {
      filter.paidAt = {};
      if (query.from) (filter.paidAt as Record<string, unknown>).$gte = new Date(query.from);
      if (query.to) (filter.paidAt as Record<string, unknown>).$lte = new Date(query.to);
    }
    const sort = this.parseSort(query.sort);
    const [data, total] = await Promise.all([
      this.paymentModel.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.paymentModel.countDocuments(filter).exec(),
    ]);
    const enriched = data.map((p) => ({
      ...p,
      id: String(p._id),
      invoiceId: String(p.invoiceId),
      clientId: p.clientId ? String(p.clientId) : null,
    }));
    return makePaginated(enriched, page, limit, total);
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Payment not found');
    const payment = await this.paymentModel.findById(id).lean().exec();
    if (!payment) throw new NotFoundException('Payment not found');
    return { ...payment, id: String(payment._id), invoiceId: String(payment.invoiceId) };
  }

  async create(dto: CreatePaymentDto, actor: JwtUser) {
    if (!Types.ObjectId.isValid(dto.invoiceId)) throw new NotFoundException('Invoice not found');
    const invoice = await this.invoiceModel.findById(dto.invoiceId).lean().exec();
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'void') throw new BadRequestException('Cannot pay a voided invoice');
    if (invoice.status === 'paid') throw new BadRequestException('Invoice is already paid');

    const amount = Number(dto.amount);
    const balance = Number(invoice.total) - Number(invoice.amountPaid);
    if (amount > balance + 0.001) {
      throw new BadRequestException(`Amount exceeds remaining balance of ${balance.toFixed(2)}`);
    }

    const client = invoice.clientId
      ? await this.clientModel.findById(invoice.clientId).lean().exec()
      : null;

    const paymentNumber = await this.companyService.nextNumber('payment');
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    const payment = await this.paymentModel.create({
      paymentNumber,
      invoiceId: new Types.ObjectId(dto.invoiceId),
      clientId: invoice.clientId ?? null,
      clientName: client?.name ?? invoice.clientName,
      amount,
      method: dto.method,
      reference: dto.reference ?? '',
      paidAt,
      note: dto.note ?? '',
      status: 'completed',
      createdBy: new Types.ObjectId(actor.id),
    });

    await this.invoiceModel.findByIdAndUpdate(dto.invoiceId, {
      $set: { sentAt: invoice.sentAt ?? new Date() },
    }).exec();
    await this.applyPaymentToInvoice(dto.invoiceId, amount, actor);

    await this.auditService.record({
      action: 'payment.create',
      entityType: 'Payment',
      entityId: String(payment._id),
      description: `Recorded payment ${payment.paymentNumber} of ${amount} on ${invoice.invoiceNumber}`,
      actor,
    });
    await this.notificationsService.notifyMany([actor.id], {
      type: 'invoice',
      title: 'Payment received',
      body: `${payment.paymentNumber} of ${amount} ${invoice.currency ?? ''} applied to ${invoice.invoiceNumber}`,
      entityType: 'Payment',
      entityId: String(payment._id),
    });

    return this.findById(String(payment._id));
  }

  async update(id: string, dto: UpdatePaymentDto, actor: JwtUser) {
    const payment = await this.requireEditable(id);
    await this.paymentModel.findByIdAndUpdate(id, { $set: dto }, { new: true }).exec();
    await this.auditService.record({
      action: 'payment.update',
      entityType: 'Payment',
      entityId: id,
      description: `Updated payment ${payment.paymentNumber}`,
      actor,
    });
    return this.findById(id);
  }

  async void(id: string, actor: JwtUser) {
    const payment = await this.requireEditable(id);
    if (payment.status === 'voided') throw new BadRequestException('Payment already voided');
    await this.paymentModel.findByIdAndUpdate(id, {
      $set: { status: 'voided', voidedBy: new Types.ObjectId(actor.id), voidedAt: new Date() },
    }).exec();
    await this.rollbackPaymentFromInvoice(String(payment.invoiceId), payment.amount);
    await this.auditService.record({
      action: 'payment.void',
      entityType: 'Payment',
      entityId: id,
      description: `Voided payment ${payment.paymentNumber}`,
      actor,
    });
    return { message: 'Payment voided' };
  }

  async toCsv(query: PaymentQueryDto): Promise<string> {
    const result = await this.list({ ...query, page: 1, limit: 100 });
    const rows = result.data.map((p) => ({
      paymentNumber: p.paymentNumber,
      clientName: p.clientName,
      amount: p.amount,
      method: p.method,
      paidAt: (p.paidAt as Date).toISOString().slice(0, 10),
      reference: p.reference,
      status: p.status,
      note: p.note,
    }));
    return toCsv(rows);
  }

  private async applyPaymentToInvoice(
    invoiceId: string,
    amount: number,
    _actor: JwtUser,
  ): Promise<void> {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'void') throw new BadRequestException('Cannot pay a voided invoice');

    const billed = Number(invoice.total || 0);
    const already = Number(invoice.amountPaid || 0);
    const amountPaid = Math.min(billed, already + amount);
    const fullyPaid = amountPaid + 0.001 >= billed;
    const status: InvoiceStatus = fullyPaid ? 'paid' : 'partial';

    invoice.amountPaid = amountPaid;
    invoice.status = status;
    invoice.paidAt = fullyPaid ? new Date() : null;
    await invoice.save();
  }

  private async rollbackPaymentFromInvoice(invoiceId: string, amount: number): Promise<void> {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) return;
    const amountPaid = Math.max(0, Number(invoice.amountPaid || 0) - amount);
    const total = Number(invoice.total || 0);
    let status: InvoiceStatus;
    if (amountPaid <= 0) status = invoice.sentAt ? 'sent' : 'draft';
    else if (amountPaid + 0.001 >= total) status = 'paid';
    else status = 'partial';
    invoice.amountPaid = amountPaid;
    invoice.status = status;
    invoice.paidAt = status === 'paid' ? invoice.paidAt : null;
    await invoice.save();
  }

  private async requireEditable(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Payment not found');
    const payment = await this.paymentModel.findById(id).lean().exec();
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  private parseSort(sort?: string): Record<string, 1 | -1> {
    if (!sort) return { paidAt: -1 };
    const [field, dir] = sort.split(':');
    const allowed = ['paymentNumber', 'clientName', 'amount', 'method', 'paidAt', 'createdAt'];
    if (!allowed.includes(field)) return { paidAt: -1 };
    return { [field]: dir === 'asc' ? 1 : -1 };
  }
}