import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true, collection: 'products' })
export class Product {
  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ default: '', sparse: true })
  sku: string;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: 'Service' })
  category: string;

  @Prop({ required: true })
  unitPrice: number;

  @Prop({ type: Types.ObjectId, ref: 'Tax', default: null })
  taxId?: Types.ObjectId | null;

  @Prop({ default: true, index: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

ProductSchema.index({ name: 1, isActive: 1 });