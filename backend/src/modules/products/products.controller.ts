import {
  Body, Controller, Delete, Get, Header, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductsService, ProductInput } from './products.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

class CreateProductDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice: number;

  @IsOptional()
  taxId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  taxId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions('product.read')
  @ApiOperation({ summary: 'List products' })
  list(
    @Query('page') page?: string, @Query('limit') limit?: string,
    @Query('search') search?: string, @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.productsService.list({ page: Number(page), limit: Number(limit), search, category, status });
  }

  @Get('export')
  @RequirePermissions('product.read')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="products.csv"')
  @ApiOperation({ summary: 'Export products as CSV' })
  async export(@Query('search') search?: string, @Query('category') category?: string, @Query('status') status?: string) {
    return this.productsService.toCsv({ search, category, status });
  }

  @Post()
  @RequirePermissions('product.create')
  @ApiOperation({ summary: 'Create a product' })
  create(@Body() dto: CreateProductDto, @CurrentUser() actor: JwtUser) {
    return this.productsService.create(dto as unknown as ProductInput, actor);
  }

  @Get(':id')
  @RequirePermissions('product.read')
  @ApiOperation({ summary: 'Get a product' })
  findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('product.update')
  @ApiOperation({ summary: 'Update a product' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() actor: JwtUser) {
    return this.productsService.update(id, dto as unknown as Partial<ProductInput>, actor);
  }

  @Delete(':id')
  @RequirePermissions('product.delete')
  @ApiOperation({ summary: 'Delete a product' })
  remove(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.productsService.remove(id, actor);
  }
}