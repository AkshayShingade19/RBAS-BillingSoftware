import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type QuoteDocument = HydratedDocument<Quote>;

export const QUOTE_STATUS = ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] as const;
export type QuoteStatus = (typeof QUOTE_STATUS)[number];

export class QuoteItem {
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

@Schema({ timestamps: true, collection: 'quotes' })
export class Quote {
  @Prop({ required: true, unique: true, index: true })
  quoteNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'Client', required: true, index: true })
  clientId: Types.ObjectId;

  @Prop({ default: '', index: true })
  clientName: string;

  @Prop({ required: true, index: true })
  issueDate: Date;

  @Prop({ required: true, index: true })
  validUntil: Date;

  @Prop({ enum: QUOTE_STATUS, default: 'draft', index: true })
  status: QuoteStatus;

  @Prop({ type: [QuoteItem], default: [] })
  items: QuoteItem[];

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

  @Prop({ default: '' })
  currency: string;

  @Prop({ default: '' })
  notes: string;

  @Prop({ default: '' })
  terms: string;

  @Prop({ type: Types.ObjectId, ref: 'Invoice', default: null })
  convertedToInvoiceId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const QuoteSchema = SchemaFactory.createForClass(Quote);

QuoteSchema.index({ clientId: 1, status: 1 });
QuoteSchema.index({ createdAt: -1 });