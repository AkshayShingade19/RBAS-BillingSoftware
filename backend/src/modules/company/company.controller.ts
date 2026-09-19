import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompanyService } from './company.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Company')
@ApiBearerAuth()
@Controller('company')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get()
  @RequirePermissions('company.read')
  @ApiOperation({ summary: 'Get workspace settings' })
  get() {
    return this.companyService.get();
  }

  @Patch()
  @RequirePermissions('settings.manage')
  @ApiOperation({ summary: 'Update workspace settings' })
  update(@Body() dto: Record<string, unknown>, @CurrentUser() actor: JwtUser) {
    return this.companyService.update(dto, actor);
  }
}