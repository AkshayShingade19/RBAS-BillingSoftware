import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  actorId?: Types.ObjectId | null;

  @Prop({ default: 'System' })
  actorName: string;

  @Prop({ required: true, index: true })
  action: string;

  @Prop({ default: '' , index: true})
  entityType: string;

  @Prop({ default: '' })
  entityId: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;

  @Prop({ default: '' })
  ip: string;

  @Prop({ default: '' })
  userAgent: string;

  createdAt: Date;
  updatedAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });