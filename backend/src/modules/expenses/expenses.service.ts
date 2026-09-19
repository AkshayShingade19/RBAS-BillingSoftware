import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Expense } from './schemas/expense.schema';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { Paginated, makePaginated } from '../../common/dto/pagination.dto';
import { toCsv } from '../../common/utils/csv.util';

export interface ExpenseInput {
  category: string;
  vendor?: string;
  amount: number;
  expenseDate?: string;
  method?: string;
  status?: string;
  note?: string;
}

export interface ExpenseQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name) private readonly expenseModel: Model<Expense>,
    private readonly auditService: AuditService,
  ) {}

  async list(query: ExpenseQuery): Promise<Paginated<Expense>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    const filter: Record<string, unknown> = {};
    if (query.category) filter.category = query.category;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      filter.expenseDate = {};
      if (query.from) (filter.expenseDate as Record<string, unknown>).$gte = new Date(query.from);
      if (query.to) (filter.expenseDate as Record<string, unknown>).$lte = new Date(query.to);
    }
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ vendor: rx }, { category: rx }, { note: rx }];
    }
    const [data, total] = await Promise.all([
      this.expenseModel.find(filter).sort({ expenseDate: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.expenseModel.countDocuments(filter).exec(),
    ]);
    return makePaginated(data, page, limit, total);
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException('Expense not found');
    const expense = await this.expenseModel.findById(id).lean().exec();
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async create(dto: ExpenseInput, actor: JwtUser) {
    const record = await this.expenseModel.create({
      category: dto.category.trim(),
      vendor: dto.vendor ?? 'Other',
      amount: Math.max(0, Number(dto.amount)),
      expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : new Date(),
      method: dto.method ?? 'other',
      status: dto.status ?? 'pending',
      note: dto.note ?? '',
      createdBy: new Types.ObjectId(actor.id),
    });
    await this.auditService.record({
      action: 'expense.create', entityType: 'Expense', entityId: String(record._id),
      description: `Created expense of ${record.amount} in ${record.category}`, actor,
    });
    return record.toObject();
  }

  async update(id: string, dto: Partial<ExpenseInput>, actor: JwtUser) {
    const patch: Record<string, unknown> = { ...dto };
    if (dto.expenseDate) patch.expenseDate = new Date(dto.expenseDate);
    if (dto.amount !== undefined) patch.amount = Math.max(0, Number(dto.amount));
    const record = await this.expenseModel.findByIdAndUpdate(id, { $set: patch }, { new: true }).lean().exec();
    if (!record) throw new NotFoundException('Expense not found');
    await this.auditService.record({
      action: 'expense.update', entityType: 'Expense', entityId: id,
      description: `Updated expense of ${record.amount} in ${record.category}`, actor,
    });
    return record;
  }

  async remove(id: string, actor: JwtUser) {
    const record = await this.expenseModel.findByIdAndDelete(id).lean().exec();
    if (!record) throw new NotFoundException('Expense not found');
    await this.auditService.record({
      action: 'expense.delete', entityType: 'Expense', entityId: id,
      description: `Deleted expense of ${record.amount} in ${record.category}`, actor,
    });
    return { message: 'Expense deleted' };
  }

  async toCsv(query: ExpenseQuery) {
    const result = await this.list({ ...query, page: 1, limit: 100 });
    const rows = result.data.map((e) => ({
      category: e.category, vendor: e.vendor, amount: e.amount,
      expenseDate: (e.expenseDate as Date).toISOString().slice(0, 10),
      method: e.method, status: e.status, note: e.note,
    }));
    return toCsv(rows);
  }
}