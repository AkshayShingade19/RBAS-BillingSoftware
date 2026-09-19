import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ClientDocument = HydratedDocument<Client>;

@Schema({ timestamps: true, collection: 'clients' })
export class Client {
  @Prop({ required: true, trim: true, index: true })
  name: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  website: string;

  @Prop({ default: '' })
  taxId: string;

  @Prop({
    type: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      zip: String,
      country: String,
    },
    default: {},
  })
  address: Record<string, string>;

  @Prop({ enum: ['active', 'inactive'], default: 'active', index: true })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const ClientSchema = SchemaFactory.createForClass(Client);

ClientSchema.index({ name: 1, status: 1 });