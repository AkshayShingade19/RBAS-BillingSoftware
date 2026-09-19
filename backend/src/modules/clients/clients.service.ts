import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Client } from './schemas/client.schema';
import { Invoice } from '../invoices/schemas/invoice.schema';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { Paginated, makePaginated } from '../../common/dto/pagination.dto';
import { toCsv } from '../../common/utils/csv.util';

export interface ClientInput {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  address?: Record<string, string>;
  status?: string;
}

export interface ClientQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort?: string;
}

@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(Client.name) private readonly clientModel: Model<Client>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<Invoice>,
    private readonly auditService: AuditService,
  ) {}

  async list(query: ClientQuery): Promise<Paginated<Client>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { taxId: rx }];
    }
    const sort = query.sort === 'name' ? { name: 1 } : query.sort === 'name:asc' ? { name: 1 } : { createdAt: -1 };
    const [data, total] = await Promise.all([
      this.clientModel.find(filter).sort(sort as never).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.clientModel.countDocuments(filter).exec(),
    ]);
    return makePaginated(data, page, limit, total);
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Client not found');
    const client = await this.clientModel.findById(id).lean().exec();
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  private async buildStats(id: string) {
    if (!Types.ObjectId.isValid(id)) return null;
    const [summary] = await this.invoiceModel.aggregate([
      { $match: { clientId: new Types.ObjectId(id), status: { $ne: 'void' } } },
      {
        $group: {
          _id: null,
          totalInvoiced: { $sum: '$total' },
          amountPaid: { $sum: '$amountPaid' },
        },
      },
    ]).exec();
    const totalInvoiced = summary?.totalInvoiced ?? 0;
    const amountPaid = summary?.amountPaid ?? 0;
    return { totalInvoiced, amountPaid, balanceDue: totalInvoiced - amountPaid };
  }

  async detail(id: string, page = 1, limit = 10) {
    const client = await this.findById(id);
    const stats = await this.buildStats(id);
    const invoices = await this.invoiceModel
      .find({ clientId: new Types.ObjectId(id) })
      .sort({ createdAt: -1 })
      .skip((Math.max(1, page) - 1) * limit)
      .limit(limit)
      .lean()
      .exec();
    return { client, stats, invoices };
  }

  async create(dto: ClientInput, actor: JwtUser) {
    const record = await this.clientModel.create({
      ...dto,
      name: dto.name.trim(),
      status: dto.status ?? 'active',
      createdBy: new Types.ObjectId(actor.id),
    });
    await this.auditService.record({
      action: 'client.create', entityType: 'Client', entityId: String(record._id),
      description: `Created client ${record.name}`, actor,
    });
    return record.toObject();
  }

  async update(id: string, dto: Partial<ClientInput>, actor: JwtUser) {
    const record = await this.clientModel.findByIdAndUpdate(id, { $set: dto }, { new: true }).lean().exec();
    if (!record) throw new NotFoundException('Client not found');
    await this.auditService.record({
      action: 'client.update', entityType: 'Client', entityId: id,
      description: `Updated client ${record.name}`, actor,
    });
    return record;
  }

  async remove(id: string, actor: JwtUser) {
    const record = await this.clientModel.findByIdAndDelete(id).lean().exec();
    if (!record) throw new NotFoundException('Client not found');
    await this.auditService.record({
      action: 'client.delete', entityType: 'Client', entityId: id,
      description: `Deleted client ${record.name}`, actor,
    });
    return { message: 'Client deleted' };
  }

  async toCsv(query: ClientQuery) {
    const result = await this.list({ ...query, page: 1, limit: 100 });
    const rows = result.data.map((c) => ({
      name: c.name, email: c.email, phone: c.phone, taxId: c.taxId, status: c.status,
      city: c.address?.city ?? '', country: c.address?.country ?? '',
    }));
    return toCsv(rows);
  }

  async idsToNames(): Promise<Map<string, string>> {
    const clients = await this.clientModel.find().select('name').lean().exec();
    return new Map(clients.map((c) => [String(c._id), c.name]));
  }
}