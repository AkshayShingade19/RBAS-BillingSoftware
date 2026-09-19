import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsIn, IsString } from 'class-validator';
import { RolesService } from './roles.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { ALL_PERMISSIONS } from './permissions.constants';

export class UpdateRoleDto {
  @IsArray()
  @IsString({ each: true })
  @IsIn(ALL_PERMISSIONS, { each: true })
  permissions: string[];
}

@ApiTags('Roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermissions('role.read')
  @ApiOperation({ summary: 'List roles and their permissions' })
  list() {
    return this.rolesService.list();
  }

  @Patch(':key')
  @RequirePermissions('role.manage')
  @ApiOperation({ summary: 'Update role permissions' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.rolesService.update(key, dto.permissions, actor);
  }
}