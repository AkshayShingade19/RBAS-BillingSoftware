import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product } from './schemas/product.schema';
import { Tax } from '../taxes/schemas/tax.schema';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { Paginated, makePaginated } from '../../common/dto/pagination.dto';
import { toCsv } from '../../common/utils/csv.util';

export interface ProductInput {
  name: string;
  sku?: string;
  description?: string;
  category?: string;
  unitPrice: number;
  taxId?: string | null;
  isActive?: boolean;
}

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<Product>,
    @InjectModel(Tax.name) private readonly taxModel: Model<Tax>,
    private readonly auditService: AuditService,
  ) {}

  async list(query: ProductQuery): Promise<Paginated<Record<string, unknown>>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const filter: Record<string, unknown> = {};
    if (query.status === 'active') filter.isActive = true;
    if (query.status === 'inactive') filter.isActive = false;
    if (query.category) filter.category = query.category;
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: rx }, { sku: rx }, { description: rx }];
    }
    const [data, total] = await Promise.all([
      this.productModel.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    const taxIds = [...new Set(data.map((p) => p.taxId && String(p.taxId)).filter(Boolean))];
    const taxes = await this.taxModel.find({ _id: { $in: taxIds } }).lean().exec();
    const taxMap = new Map(taxes.map((t) => [String(t._id), t]));

    const enriched = data.map((p) => ({
      id: String(p._id),
      name: p.name,
      sku: p.sku,
      description: p.description,
      category: p.category,
      unitPrice: p.unitPrice,
      taxId: p.taxId ? String(p.taxId) : null,
      tax: p.taxId ? taxMap.get(String(p.taxId)) ?? null : null,
      isActive: p.isActive,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return makePaginated(enriched, page, limit, total);
  }

  async findById(id: string) {
    const product = await this.productModel.findById(id).lean().exec();
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: ProductInput, actor: JwtUser) {
    if (dto.taxId) {
      const tax = await this.taxModel.findById(dto.taxId).lean().exec();
      if (!tax) throw new NotFoundException('Tax not found');
    }
    const record = await this.productModel.create({
      ...dto,
      taxId: dto.taxId ? new Types.ObjectId(dto.taxId) : null,
      unitPrice: Math.max(0, Number(dto.unitPrice)),
    });
    await this.auditService.record({
      action: 'product.create', entityType: 'Product', entityId: String(record._id),
      description: `Created product ${record.name}`, actor,
    });
    return this.findById(String(record._id));
  }

  async update(id: string, dto: Partial<ProductInput>, actor: JwtUser) {
    if (dto.taxId) {
      const tax = await this.taxModel.findById(dto.taxId).lean().exec();
      if (!tax) throw new NotFoundException('Tax not found');
    }
    const patch: Record<string, unknown> = { ...dto };
    if (dto.taxId !== undefined) patch.taxId = dto.taxId ? new Types.ObjectId(dto.taxId) : null;
    if (dto.unitPrice !== undefined) patch.unitPrice = Math.max(0, Number(dto.unitPrice));
    const record = await this.productModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean().exec();
    if (!record) throw new NotFoundException('Product not found');
    await this.auditService.record({
      action: 'product.update', entityType: 'Product', entityId: id,
      description: `Updated product ${record.name}`, actor,
    });
    return this.findById(id);
  }

  async remove(id: string, actor: JwtUser) {
    const record = await this.productModel.findByIdAndDelete(id).lean().exec();
    if (!record) throw new NotFoundException('Product not found');
    await this.auditService.record({
      action: 'product.delete', entityType: 'Product', entityId: id,
      description: `Deleted product ${record.name}`, actor,
    });
    return { message: 'Product deleted' };
  }

  async toCsv(query: ProductQuery) {
    const result = await this.list({ ...query, page: 1, limit: 100 });
    const rows = result.data.map((p) => ({
      name: p.name, sku: p.sku ?? '', category: p.category,
      unitPrice: p.unitPrice, status: p.isActive ? 'active' : 'inactive',
    }));
    return toCsv(rows);
  }
}