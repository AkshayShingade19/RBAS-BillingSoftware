import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OtpDocument = HydratedDocument<Otp>;

export const OTP_PURPOSES = ['verify_email', 'password_reset'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

@Schema({ timestamps: true, collection: 'otps' })
export class Otp {
  @Prop({ required: true, index: true })
  email: string;

  @Prop({ enum: OTP_PURPOSES, required: true, index: true })
  purpose: OtpPurpose;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ type: Date, default: null })
  consumedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);