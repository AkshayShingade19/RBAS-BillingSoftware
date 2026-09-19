import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog } from './schemas/audit-log.schema';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { Paginated, makePaginated } from '../../common/dto/pagination.dto';
import { toCsv } from '../../common/utils/csv.util';

export interface AuditInput {
  action: string;
  entityType?: string;
  entityId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  actor?: JwtUser | null;
  ip?: string;
  userAgent?: string;
}

export interface AuditQuery {
  page?: number;
  limit?: number;
  search?: string;
  action?: string;
  entityType?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AuditService {
  constructor(@InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLog>) {}

  async record(input: AuditInput): Promise<void> {
    try {
      await this.auditModel.create({
        actorId: input.actor ? new Types.ObjectId(input.actor.id) : null,
        actorName: input.actor?.name ?? 'System',
        action: input.action,
        entityType: input.entityType ?? '',
        entityId: input.entityId ?? '',
        description: input.description ?? '',
        metadata: input.metadata ?? {},
        ip: input.ip ?? '',
        userAgent: (input.userAgent ?? '').slice(0, 300),
      });
    } catch {
      // Audit failures must never break the business operation.
    }
  }

  async list(query: AuditQuery): Promise<Paginated<AuditLog>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const filter: Record<string, unknown> = {};

    if (query.action) filter.action = query.action;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.actorId && Types.ObjectId.isValid(query.actorId)) {
      filter.actorId = new Types.ObjectId(query.actorId);
    }
    if (query.from || query.to) {
      filter.createdAt = {};
      if (query.from) (filter.createdAt as Record<string, unknown>).$gte = new Date(query.from);
      if (query.to) (filter.createdAt as Record<string, unknown>).$lte = new Date(query.to);
    }
    if (query.search) {
      const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ actorName: rx }, { action: rx }, { description: rx }, { entityType: rx }];
    }

    const [data, total] = await Promise.all([
      this.auditModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);

    return makePaginated(data, page, limit, total);
  }

  async activityForUser(userId: string, limit = 10): Promise<AuditLog[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    return this.auditModel
      .find({ actorId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async toCsv(query: AuditQuery): Promise<string> {
    const result = await this.list({ ...query, page: 1, limit: 100 });
    const rows = result.data.map((log) => ({
      timestamp: log.createdAt,
      actor: log.actorName,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      description: log.description,
    }));
    return toCsv(rows as Record<string, unknown>[]);
  }
}