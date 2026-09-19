import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppNotification, NotificationType } from './schemas/notification.schema';
import { User } from '../users/schemas/user.schema';
import { JwtUser } from '../../common/decorators/current-user.decorator';
import { Paginated, makePaginated } from '../../common/dto/pagination.dto';

export interface CreateNotificationInput {
  userId: string;
  type?: NotificationType;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(AppNotification.name)
    private readonly notificationModel: Model<AppNotification>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  async create(input: CreateNotificationInput): Promise<AppNotification> {
    const doc = await this.notificationModel.create({
      userId: new Types.ObjectId(input.userId),
      type: input.type ?? 'system',
      title: input.title,
      body: input.body ?? '',
      entityType: input.entityType ?? '',
      entityId: input.entityId ?? '',
      data: input.data ?? {},
    });
    return doc.toObject();
  }

  async notifyMany(userIds: string[], input: Omit<CreateNotificationInput, 'userId'>) {
    const docs = userIds.map((userId) => ({
      userId: new Types.ObjectId(userId),
      type: input.type ?? 'system',
      title: input.title,
      body: input.body ?? '',
      entityType: input.entityType ?? '',
      entityId: input.entityId ?? '',
      data: input.data ?? {},
    }));
    await this.notificationModel.insertMany(docs);
  }

  async list(
    userId: string,
    page = 1,
    limit = 20,
    unreadOnly = false,
  ): Promise<Paginated<AppNotification>> {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (unreadOnly) filter.readAt = null;

    const [data, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.notificationModel.countDocuments(filter).exec(),
    ]);
    return makePaginated(data.map((n) => ({ ...n, id: String(n._id) })), page, limit, total);
  }

  async unreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      readAt: null,
    });
  }

  async markRead(userId: string, notificationId: string) {
    const result = await this.notificationModel
      .findOneAndUpdate(
        { _id: notificationId, userId: new Types.ObjectId(userId) },
        { $set: { readAt: new Date() } },
        { new: true },
      )
      .lean()
      .exec();
    if (!result) throw new NotFoundException('Notification not found');
    return result;
  }

  async markAllRead(userId: string) {
    await this.notificationModel
      .updateMany(
        { userId: new Types.ObjectId(userId), readAt: null },
        { $set: { readAt: new Date() } },
      )
      .exec();
    return { message: 'All notifications marked as read' };
  }

  async broadcast(input: { title: string; body?: string }, actor: JwtUser) {
    const users = await this.userModel.find({ status: 'active' }).select('_id').lean().exec();
    const ids = users.map((u) => String(u._id));
    await this.notifyMany(ids, {
      type: 'broadcast',
      title: input.title,
      body: input.body ?? '',
      entityType: 'system',
    });
    return { message: `Broadcast sent to ${ids.length} active users` };
  }
}