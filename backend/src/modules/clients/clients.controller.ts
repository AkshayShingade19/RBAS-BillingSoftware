import {
  Body, Controller, Delete, Get, Header, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ClientsService, ClientInput } from './clients.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

class CreateClientDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @IsOptional()
  address?: Record<string, string>;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}

class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @IsOptional()
  address?: Record<string, string>;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: string;
}

@ApiTags('Clients')
@ApiBearerAuth()
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @RequirePermissions('client.read')
  @ApiOperation({ summary: 'List clients' })
  list(
    @Query('page') page?: string, @Query('limit') limit?: string,
    @Query('search') search?: string, @Query('status') status?: string,
    @Query('sort') sort?: string,
  ) {
    return this.clientsService.list({ page: Number(page), limit: Number(limit), search, status, sort });
  }

  @Get('export')
  @RequirePermissions('client.read')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="clients.csv"')
  @ApiOperation({ summary: 'Export clients as CSV' })
  async export(@Query('search') search?: string, @Query('status') status?: string) {
    return this.clientsService.toCsv({ search, status });
  }

  @Post()
  @RequirePermissions('client.create')
  @ApiOperation({ summary: 'Create a client' })
  create(@Body() dto: CreateClientDto, @CurrentUser() actor: JwtUser) {
    return this.clientsService.create(dto as unknown as ClientInput, actor);
  }

  @Get(':id')
  @RequirePermissions('client.read')
  @ApiOperation({ summary: 'Get a client with summary stats' })
  detail(@Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.clientsService.detail(id, Number(page) || 1, Number(limit) || 10);
  }

  @Patch(':id')
  @RequirePermissions('client.update')
  @ApiOperation({ summary: 'Update a client' })
  update(@Param('id') id: string, @Body() dto: UpdateClientDto, @CurrentUser() actor: JwtUser) {
    return this.clientsService.update(id, dto as unknown as Partial<ClientInput>, actor);
  }

  @Delete(':id')
  @RequirePermissions('client.delete')
  @ApiOperation({ summary: 'Delete a client' })
  remove(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.clientsService.remove(id, actor);
  }
}