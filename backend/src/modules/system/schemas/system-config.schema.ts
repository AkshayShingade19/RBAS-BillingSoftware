import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SystemConfigDocument = HydratedDocument<SystemConfig>;

const SYSTEM_CONFIG_ID = 'platform-config';

@Schema({ timestamps: true, collection: 'system_config' })
export class SystemConfig {
  @Prop({ required: true, unique: true, default: SYSTEM_CONFIG_ID })
  key: string;

  @Prop({ default: 'Ledgerly' })
  appName: string;

  @Prop({ default: true })
  signupsEnabled: boolean;

  @Prop({ default: false })
  maintenanceMode: boolean;

  @Prop({ default: 'Ledgerly by RBAS TechLabs' })
  footerCompanyName: string;

  @Prop({ default: '' })
  supportEmail: string;
}

export const SystemConfigSchema = SchemaFactory.createForClass(SystemConfig);

export { SYSTEM_CONFIG_ID };