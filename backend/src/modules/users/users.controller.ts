import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Headers,
  Ip,
  Header,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  ChangePasswordDto,
  CreateUserDto,
  UpdateUserDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from './dto/user.dto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AuditService } from '../audit/audit.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequirePermissions('user.read')
  @ApiOperation({ summary: 'List users' })
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
  ) {
    return this.usersService.list({ page: Number(page), limit: Number(limit), search, role, status, sort });
  }

  @Post()
  @RequirePermissions('user.create')
  @ApiOperation({ summary: 'Create a user' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: JwtUser) {
    return this.usersService.create(dto, actor);
  }

  @Get('export')
  @RequirePermissions('user.read')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="users.csv"')
  @ApiOperation({ summary: 'Export users as CSV' })
  async export(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.usersService.toCsv({ search, role, status });
  }

  @Get(':id')
  @RequirePermissions('user.read')
  @ApiOperation({ summary: 'Get a user' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('user.update')
  @ApiOperation({ summary: 'Update a user' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: JwtUser) {
    return this.usersService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('user.delete')
  @ApiOperation({ summary: 'Delete a user' })
  remove(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.usersService.remove(id, actor);
  }

  @Patch(':id/status')
  @RequirePermissions('user.manage')
  @ApiOperation({ summary: 'Change user status' })
  status(@Param('id') id: string, @Body() dto: UpdateUserStatusDto, @CurrentUser() actor: JwtUser) {
    return this.usersService.setStatus(id, dto.status, actor);
  }

  @Patch(':id/role')
  @RequirePermissions('user.manage')
  @ApiOperation({ summary: 'Change user role' })
  role(@Param('id') id: string, @Body() dto: UpdateUserRoleDto, @CurrentUser() actor: JwtUser) {
    return this.usersService.setRole(id, dto.role, actor);
  }

  @Get(':id/activity')
  @RequirePermissions('user.read')
  @ApiOperation({ summary: 'Recent activity for a user' })
  activity(@Param('id') id: string) {
    return this.usersService.activity(id);
  }
}

@ApiTags('Me')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Current user profile' })
  profile(@CurrentUser() user: JwtUser) {
    return this.usersService.getProfile(user.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user profile' })
  update(@Body() dto: UpdateUserDto, @CurrentUser() user: JwtUser) {
    return this.usersService.updateProfile(user.id, dto, user);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: JwtUser) {
    return this.usersService.changePassword(user.id, dto, user);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Recent activity for the current user' })
  activity(@CurrentUser() user: JwtUser) {
    return this.usersService.activity(user.id, 10);
  }
}