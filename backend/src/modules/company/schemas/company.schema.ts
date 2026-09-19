import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CompanyDocument = HydratedDocument<Company>;

const COMPANY_SINGLETON_ID = 'company-primary';

@Schema({ timestamps: true, collection: 'company' })
export class Company {
  @Prop({ required: true, default: COMPANY_SINGLETON_ID, unique: true })
  key: string;

  @Prop({ default: 'Ledgerly Workspace' })
  name: string;

  @Prop({ default: 'Ledgerly TechLabs' })
  legalName: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  website: string;

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

  @Prop({ default: 'USD' })
  currency: string;

  @Prop({ default: 'INV' })
  invoicePrefix: string;

  @Prop({ default: 1 })
  invoiceNextNumber: number;

  @Prop({ default: 'QT' })
  quotePrefix: string;

  @Prop({ default: 1 })
  quoteNextNumber: number;

  @Prop({ default: 'PAY' })
  paymentPrefix: string;

  @Prop({ default: 1 })
  paymentNextNumber: number;

  @Prop({ default: 'Tax' })
  taxLabel: string;

  @Prop({ default: 14 })
  defaultPaymentTermsDays: number;

  @Prop({ default: '' })
  footerNote: string;

  @Prop({ default: '' })
  logoUrl: string;
}

export const CompanySchema = SchemaFactory.createForClass(Company);

export { COMPANY_SINGLETON_ID };