import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { SystemConfig, SYSTEM_CONFIG_ID } from './schemas/system-config.schema';
import { Public } from '../../common/decorators/public.decorator';
import { JwtUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditService } from '../audit/audit.service';

class UpdateSystemConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  appName?: string;

  @IsOptional()
  @IsBoolean()
  signupsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  footerCompanyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supportEmail?: string;
}

@ApiTags('System')
@Controller('system')
export class SystemController {
  constructor(
    @InjectModel(SystemConfig.name) private readonly systemModel: Model<SystemConfig>,
    private readonly auditService: AuditService,
  ) {}

  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Public platform configuration (used pre-login)' })
  async getConfig() {
    const config = await this.systemModel.findOne({ key: SYSTEM_CONFIG_ID }).lean().exec();
    return {
      appName: config?.appName ?? 'Ledgerly',
      signupsEnabled: config?.signupsEnabled ?? true,
      maintenanceMode: config?.maintenanceMode ?? false,
      footerCompanyName: config?.footerCompanyName ?? 'Ledgerly by RBAS TechLabs',
      supportEmail: config?.supportEmail ?? '',
    };
  }

  @Patch('config')
  @ApiBearerAuth()
  @RequirePermissions('system.manage')
  @ApiOperation({ summary: 'Update platform configuration (super admin)' })
  async updateConfig(@Body() dto: UpdateSystemConfigDto, @CurrentUser() actor: JwtUser) {
    const config = await this.systemModel.findOneAndUpdate(
      { key: SYSTEM_CONFIG_ID },
      { $set: dto, $setOnInsert: { key: SYSTEM_CONFIG_ID } },
      { new: true, upsert: true },
    ).lean().exec();
    await this.auditService.record({
      action: 'system.config.update',
      entityType: 'System',
      description: 'Updated platform configuration',
      metadata: { fields: Object.keys(dto) },
      actor,
    });
    return config;
  }
}