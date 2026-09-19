import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TaxDocument = HydratedDocument<Tax>;

@Schema({ timestamps: true, collection: 'taxes' })
export class Tax {
  @Prop({ required: true, index: true })
  name: string;

  @Prop({ required: true })
  rate: number;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const TaxSchema = SchemaFactory.createForClass(Tax);