import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<AppNotification>;

export const NOTIFICATION_TYPES = [
  'system',
  'broadcast',
  'invoice',
  'payment',
  'quote',
  'client',
  'user',
  'auth',
  'expense',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

@Schema({ timestamps: true, collection: 'notifications', read: 'nearest' })
export class AppNotification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ enum: NOTIFICATION_TYPES, default: 'system' })
  type: NotificationType;

  @Prop({ required: true })
  title: string;

  @Prop({ default: '' })
  body: string;

  @Prop({ default: '' })
  entityType: string;

  @Prop({ default: '' })
  entityId: string;

  @Prop({ type: Object, default: {} })
  data: Record<string, unknown>;

  @Prop({ type: Date, default: null, index: true })
  readAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const AppNotificationSchema = SchemaFactory.createForClass(AppNotification);

AppNotificationSchema.index({ userId: 1, readAt: 1, createdAt: -1 });