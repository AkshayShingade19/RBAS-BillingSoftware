import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tax } from './schemas/tax.schema';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { Paginated, makePaginated } from '../../common/dto/pagination.dto';
import { toCsv } from '../../common/utils/csv.util';

export class TaxDto {
  name: string;
  rate: number;
  isActive?: boolean;
  isDefault?: boolean;
}

export interface TaxQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

@Injectable()
export class TaxesService {
  constructor(
    @InjectModel(Tax.name) private readonly taxModel: Model<Tax>,
    private readonly auditService: AuditService,
  ) {}

  async list(query: TaxQuery): Promise<Paginated<Tax>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const filter: Record<string, unknown> = {};
    if (query.status === 'active') filter.isActive = true;
    if (query.status === 'inactive') filter.isActive = false;
    if (query.search) {
      filter.name = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    const [data, total] = await Promise.all([
      this.taxModel.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.taxModel.countDocuments(filter).exec(),
    ]);
    return makePaginated(data, page, limit, total);
  }

  async create(dto: TaxDto, actor: JwtUser) {
    const record = await this.taxModel.create({
      name: dto.name.trim(),
      rate: Number(dto.rate),
      isActive: dto.isActive ?? true,
      isDefault: dto.isDefault ?? false,
    });
    if (dto.isDefault) {
      await this.taxModel.updateMany(
        { _id: { $ne: record._id } },
        { $set: { isDefault: false } },
      ).exec();
    }
    await this.auditService.record({
      action: 'tax.create', entityType: 'Tax', entityId: String(record._id),
      description: `Created tax ${record.name} at ${record.rate}%`, actor,
    });
    return record.toObject();
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Tax not found');
    const record = await this.taxModel.findById(id).lean().exec();
    if (!record) throw new NotFoundException('Tax not found');
    return record;
  }

  async update(id: string, dto: Partial<TaxDto>, actor: JwtUser) {
    const record = await this.taxModel.findByIdAndUpdate(id, { $set: dto }, { new: true }).lean().exec();
    if (!record) throw new NotFoundException('Tax not found');
    if (dto.isDefault) {
      await this.taxModel.updateMany({ _id: { $ne: id } }, { $set: { isDefault: false } }).exec();
    }
    await this.auditService.record({
      action: 'tax.update', entityType: 'Tax', entityId: id,
      description: `Updated tax ${record.name}`, actor,
    });
    return record;
  }

  async remove(id: string, actor: JwtUser) {
    const record = await this.taxModel.findByIdAndDelete(id).lean().exec();
    if (!record) throw new NotFoundException('Tax not found');
    await this.auditService.record({
      action: 'tax.delete', entityType: 'Tax', entityId: id,
      description: `Deleted tax ${record.name}`, actor,
    });
    return { message: 'Tax deleted' };
  }

  async toCsv(query: TaxQuery) {
    const result = await this.list({ ...query, page: 1, limit: 100 });
    const rows = result.data.map((t) => ({
      name: t.name, rate: t.rate, status: t.isActive ? 'active' : 'inactive', default: t.isDefault ? 'yes' : 'no',
    }));
    return toCsv(rows);
  }
}