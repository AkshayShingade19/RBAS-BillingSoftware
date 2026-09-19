import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InvoiceDocument = HydratedDocument<Invoice>;

export const INVOICE_STATUS = ['draft', 'sent', 'partial', 'paid', 'overdue', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export class InvoiceItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', default: null })
  productId?: Types.ObjectId | null;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, min: 0 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  unitPrice: number;

  @Prop({ default: 0 })
  taxPercent: number;

  @Prop({ default: 0 })
  amount: number;

  @Prop({ default: 0 })
  taxAmount: number;
}

@Schema({ timestamps: true, collection: 'invoices' })
export class Invoice {
  @Prop({ required: true, unique: true, index: true })
  invoiceNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Client', required: true, index: true })
  clientId: Types.ObjectId;

  @Prop({ default: '', index: true })
  clientName: string;

  @Prop({ required: true, index: true })
  issueDate: Date;

  @Prop({ required: true, index: true })
  dueDate: Date;

  @Prop({ enum: INVOICE_STATUS, default: 'draft', index: true })
  status: InvoiceStatus;

  @Prop({ type: [InvoiceItem], default: [] })
  items: InvoiceItem[];

  @Prop({
    type: { type: String, enum: ['percent', 'fixed'], default: 'fixed' },
    value: { type: Number, default: 0 },
  })
  discount: { type: 'percent' | 'fixed'; value: number };

  @Prop({ default: 0 })
  subtotal: number;

  @Prop({ default: 0 })
  discountAmount: number;

  @Prop({ default: 0 })
  taxTotal: number;

  @Prop({ default: 0 })
  total: number;

  @Prop({ default: 0 })
  amountPaid: number;

  @Prop({ default: '' })
  currency: string;

  @Prop({ default: '' })
  notes: string;

  @Prop({ default: '' })
  terms: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  sentAt?: Date | null;

  @Prop({ type: Date, default: null })
  paidAt?: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  voidedBy?: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  voidedAt?: Date | null;

  @Prop({ default: '' })
  voidReason: string;

  createdAt: Date;
  updatedAt: Date;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index({ clientId: 1, status: 1 });
InvoiceSchema.index({ dueDate: 1, status: 1 });
InvoiceSchema.index({ createdAt: -1 });