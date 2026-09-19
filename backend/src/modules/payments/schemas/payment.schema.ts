import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

export const PAYMENT_METHODS = ['card', 'bank', 'cash', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ required: true, unique: true, index: true })
  paymentNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Invoice', required: true, index: true })
  invoiceId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Client', default: null })
  clientId?: Types.ObjectId | null;

  @Prop({ default: '' })
  clientName: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ enum: PAYMENT_METHODS, default: 'other' })
  method: PaymentMethod;

  @Prop({ default: '' })
  reference: string;

  @Prop({ required: true, index: true })
  paidAt: Date;

  @Prop({ default: '' })
  note: string;

  @Prop({ enum: ['completed', 'voided'], default: 'completed' })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  voidedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  voidedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

PaymentSchema.index({ invoiceId: 1, paidAt: -1 });
PaymentSchema.index({ paidAt: -1 });