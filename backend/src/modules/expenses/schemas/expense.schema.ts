import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ExpenseDocument = HydratedDocument<Expense>;

export const EXPENSE_METHODS = ['card', 'bank', 'cash', 'other'] as const;
export const EXPENSE_STATUS = ['pending', 'approved', 'rejected'] as const;

@Schema({ timestamps: true, collection: 'expenses' })
export class Expense {
  @Prop({ required: true })
  category: string;

  @Prop({ default: 'Other' })
  vendor: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, index: true })
  expenseDate: Date;

  @Prop({ enum: EXPENSE_METHODS, default: 'other' })
  method: string;

  @Prop({ enum: EXPENSE_STATUS, default: 'pending', index: true })
  status: string;

  @Prop({ default: '' })
  note: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);

ExpenseSchema.index({ category: 1, expenseDate: -1 });