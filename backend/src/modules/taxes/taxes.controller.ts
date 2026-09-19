import {
  Body, Controller, Delete, Get, Header, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { TaxesService, TaxDto } from './taxes.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

class CreateTaxDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rate: number;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  isDefault?: boolean;
}

class UpdateTaxDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rate?: number;

  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  isDefault?: boolean;
}

@ApiTags('Taxes')
@ApiBearerAuth()
@Controller('taxes')
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @Get()
  @RequirePermissions('tax.read')
  @ApiOperation({ summary: 'List taxes' })
  list(@Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string, @Query('status') status?: string) {
    return this.taxesService.list({ page: Number(page), limit: Number(limit), search, status });
  }

  @Get('export')
  @RequirePermissions('tax.read')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="taxes.csv"')
  @ApiOperation({ summary: 'Export taxes as CSV' })
  async export(@Query('search') search?: string, @Query('status') status?: string) {
    return this.taxesService.toCsv({ search, status });
  }

  @Post()
  @RequirePermissions('tax.create')
  @ApiOperation({ summary: 'Create a tax' })
  create(@Body() dto: CreateTaxDto, @CurrentUser() actor: JwtUser) {
    return this.taxesService.create(dto as unknown as TaxDto, actor);
  }

  @Get(':id')
  @RequirePermissions('tax.read')
  @ApiOperation({ summary: 'Get a tax' })
  findOne(@Param('id') id: string) {
    return this.taxesService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('tax.update')
  @ApiOperation({ summary: 'Update a tax' })
  update(@Param('id') id: string, @Body() dto: UpdateTaxDto, @CurrentUser() actor: JwtUser) {
    return this.taxesService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('tax.delete')
  @ApiOperation({ summary: 'Delete a tax' })
  remove(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.taxesService.remove(id, actor);
  }
}