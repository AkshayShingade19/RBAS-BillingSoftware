import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Quote, QuoteStatus } from './schemas/quote.schema';
import { Client } from '../clients/schemas/client.schema';
import { Invoice } from '../invoices/schemas/invoice.schema';
import { CompanyService } from '../company/company.service';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { Paginated, makePaginated } from '../../common/dto/pagination.dto';
import { toCsv } from '../../common/utils/csv.util';
import { computeTotals } from '../../common/utils/totals.util';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/quote.dto';

export interface QuoteQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  clientId?: string;
  sort?: string;
}

@Injectable()
export class QuotesService {
  constructor(
    @InjectModel(Quote.name) private readonly quoteModel: Model<Quote>,
    @InjectModel(Client.name) private readonly clientModel: Model<Client>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    private readonly companyService: CompanyService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: QuoteQuery): Promise<Paginated<Record<string, unknown>>> {
    await this.applyExpirySweep();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const filter: Record<string, unknown> = {};
    if (query.status && query.status !== 'all') filter.status = query.status;
    if (query.clientId && Types.ObjectId.isValid(query.clientId)) {
      filter.clientId = new Types.ObjectId(query.clientId);
    }
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ quoteNumber: rx }, { clientName: rx }];
    }
    const sort = this.parseSort(query.sort);
    const [data, total] = await Promise.all([
      this.quoteModel.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.quoteModel.countDocuments(filter).exec(),
    ]);
    const enriched = data.map((q) => ({
      ...q,
      id: String(q._id),
      clientId: String(q.clientId),
      discount: q.discount ?? { type: 'fixed', value: 0 },
    }));
    return makePaginated(enriched, page, limit, total);
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Quote not found');
    const quote = await this.quoteModel.findById(id).lean().exec();
    if (!quote) throw new NotFoundException('Quote not found');
    return { ...quote, id: String(quote._id), clientId: String(quote.clientId) };
  }

  async create(dto: CreateQuoteDto, actor: JwtUser) {
    const client = await this.clientModel.findById(dto.clientId).lean().exec();
    if (!client) throw new NotFoundException('Client not found');

    const company = await this.companyService.get();
    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const validUntil = dto.validUntil
      ? new Date(dto.validUntil)
      : new Date(issueDate.getTime() + 30 * 86400000);

    const quoteNumber = await this.companyService.nextNumber('quote');
    const computed = this.buildComputed(dto);

    const quote = await this.quoteModel.create({
      quoteNumber,
      clientId: new Types.ObjectId(dto.clientId),
      clientName: client.name,
      issueDate,
      validUntil,
      status: 'draft',
      items: computed.items,
      discount: computed.discount,
      subtotal: computed.subtotal,
      discountAmount: computed.discountAmount,
      taxTotal: computed.taxTotal,
      total: computed.total,
      currency: (dto.currency || company.currency) as never,
      notes: dto.notes ?? '',
      terms: dto.terms ?? '',
      createdBy: new Types.ObjectId(actor.id),
    });

    await this.auditService.record({
      action: 'quote.create',
      entityType: 'Quote',
      entityId: String(quote._id),
      description: `Created quote ${quote.quoteNumber} for ${client.name}`,
      actor,
    });

    return this.findById(String(quote._id));
  }

  async update(id: string, dto: UpdateQuoteDto, actor: JwtUser) {
    const quote = await this.requireEditable(id);
    if (quote.status !== 'draft') {
      throw new BadRequestException('Only draft quotes can be edited');
    }
    const patch: Record<string, unknown> = {};
    if (dto.clientId !== undefined) {
      const client = await this.clientModel.findById(dto.clientId).lean().exec();
      if (!client) throw new NotFoundException('Client not found');
      patch.clientId = new Types.ObjectId(dto.clientId);
      patch.clientName = client.name;
    }
    if (dto.issueDate) patch.issueDate = new Date(dto.issueDate);
    if (dto.validUntil) patch.validUntil = new Date(dto.validUntil);
    const merge: Record<string, unknown> = { ...quote, ...patch };
    const computed = this.buildComputed(merge as unknown as CreateQuoteDto);
    patch.items = computed.items;
    patch.discount = computed.discount;
    patch.subtotal = computed.subtotal;
    patch.discountAmount = computed.discountAmount;
    patch.taxTotal = computed.taxTotal;
    patch.total = computed.total;
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (dto.terms !== undefined) patch.terms = dto.terms;

    await this.quoteModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec();
    await this.auditService.record({
      action: 'quote.update',
      entityType: 'Quote',
      entityId: id,
      description: `Updated quote ${quote.quoteNumber}`,
      actor,
    });
    return this.findById(id);
  }

  async setStatus(id: string, status: string, actor: JwtUser) {
    if (!['sent', 'accepted', 'rejected'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    const quote = await this.findById(id);
    const allowed: Partial<Record<QuoteStatus, QuoteStatus[]>> = {
      draft: ['sent'],
      sent: ['accepted', 'rejected'],
      expired: ['accepted'],
    };
    const transitions = allowed[quote.status as QuoteStatus];
    if (!transitions?.includes(status as QuoteStatus)) {
      throw new BadRequestException(`Cannot move quote from ${quote.status} to ${status}`);
    }
    await this.quoteModel.findByIdAndUpdate(id, { $set: { status } }).exec();
    await this.auditService.record({
      action: 'quote.status.update',
      entityType: 'Quote',
      entityId: id,
      description: `Changed quote ${quote.quoteNumber} status to ${status}`,
      actor,
    });
    return this.findById(id);
  }

  async convertToInvoice(id: string, actor: JwtUser): Promise<{ invoiceId: string }> {
    const quote = await this.findById(id);
    if (quote.status === 'converted') {
      throw new BadRequestException('Quote already converted to an invoice');
    }
    if (!['sent', 'accepted'].includes(quote.status)) {
      throw new BadRequestException('Only sent or accepted quotes can be converted');
    }
    const invoiceNumber = await this.companyService.nextNumber('invoice');
    const invoiceDoc = await this.invoiceModel.create({
      invoiceNumber,
      clientId: new Types.ObjectId(quote.clientId),
      clientName: quote.clientName,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 14 * 86400000),
      status: 'draft',
      items: quote.items.map((it) => ({ ...it })),
      discount: quote.discount,
      subtotal: quote.subtotal,
      discountAmount: quote.discountAmount,
      taxTotal: quote.taxTotal,
      total: quote.total,
      amountPaid: 0,
      currency: quote.currency,
      notes: quote.notes,
      terms: quote.terms,
      createdBy: new Types.ObjectId(actor.id),
    });
    await this.quoteModel.findByIdAndUpdate(id, {
      $set: { status: 'converted', convertedToInvoiceId: invoiceDoc._id },
    }).exec();
    await this.auditService.record({
      action: 'quote.convert',
      entityType: 'Quote',
      entityId: id,
      description: `Converted quote ${quote.quoteNumber} to invoice ${invoiceNumber}`,
      actor,
    });
    return { invoiceId: String(invoiceDoc._id) };
  }

  async remove(id: string, actor: JwtUser) {
    const quote = await this.requireEditable(id);
    if (quote.status !== 'draft') {
      throw new BadRequestException('Only draft quotes can be deleted');
    }
    await this.quoteModel.deleteOne({ _id: id }).exec();
    await this.auditService.record({
      action: 'quote.delete',
      entityType: 'Quote',
      entityId: id,
      description: `Deleted quote ${quote.quoteNumber}`,
      actor,
    });
    return { message: 'Quote deleted' };
  }

  async toCsv(query: QuoteQuery): Promise<string> {
    const result = await this.list({ ...query, page: 1, limit: 100 });
    const rows = result.data.map((q) => ({
      quoteNumber: q.quoteNumber,
      client: q.clientName,
      issueDate: (q.issueDate as Date).toISOString().slice(0, 10),
      validUntil: (q.validUntil as Date).toISOString().slice(0, 10),
      status: q.status,
      subtotal: q.subtotal,
      taxTotal: q.taxTotal,
      total: q.total,
    }));
    return toCsv(rows);
  }

  private async applyExpirySweep(): Promise<void> {
    await this.quoteModel.updateMany(
      { status: 'sent', validUntil: { $lt: new Date() } },
      { $set: { status: 'expired' } },
    ).exec();
  }

  private buildComputed(dto: CreateQuoteDto) {
    const items = (dto.items ?? []).map((it) => ({
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: Number(it.unitPrice),
      taxPercent: Number(it.taxPercent ?? 0),
    }));
    const discount = dto.discount ?? { type: 'fixed' as const, value: 0 };
    const computed = computeTotals(items, discount);
    return {
      items: computed.items,
      discount,
      subtotal: computed.subtotal,
      discountAmount: computed.discountAmount,
      taxTotal: computed.taxTotal,
      total: computed.total,
    };
  }

  private async requireEditable(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Quote not found');
    const quote = await this.quoteModel.findById(id).lean().exec();
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  private parseSort(sort?: string): Record<string, 1 | -1> {
    if (!sort) return { createdAt: -1 };
    const [field, dir] = sort.split(':');
    const allowed = ['quoteNumber', 'clientName', 'issueDate', 'validUntil', 'total', 'status', 'createdAt'];
    if (!allowed.includes(field)) return { createdAt: -1 };
    return { [field]: dir === 'asc' ? 1 : -1 };
  }
}