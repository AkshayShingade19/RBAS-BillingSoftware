import {
  Body, Controller, Delete, Get, Header, Param, Patch, Post, Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ExpensesService, ExpenseInput } from './expenses.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { EXPENSE_METHODS, EXPENSE_STATUS } from './schemas/expense.schema';

class CreateExpenseDto {
  @IsString()
  @MaxLength(100)
  category: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsOptional()
  expenseDate?: string;

  @IsOptional()
  @IsIn(EXPENSE_METHODS)
  method?: string;

  @IsOptional()
  @IsIn(EXPENSE_STATUS)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  expenseDate?: string;

  @IsOptional()
  @IsIn(EXPENSE_METHODS)
  method?: string;

  @IsOptional()
  @IsIn(EXPENSE_STATUS)
  status?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @RequirePermissions('expense.read')
  @ApiOperation({ summary: 'List expenses' })
  list(
    @Query('page') page?: string, @Query('limit') limit?: string,
    @Query('search') search?: string, @Query('category') category?: string,
    @Query('status') status?: string, @Query('from') from?: string, @Query('to') to?: string,
  ) {
    return this.expensesService.list({ page: Number(page), limit: Number(limit), search, category, status, from, to });
  }

  @Get('export')
  @RequirePermissions('expense.read')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="expenses.csv"')
  @ApiOperation({ summary: 'Export expenses as CSV' })
  async export(
    @Query('search') search?: string, @Query('category') category?: string,
    @Query('status') status?: string, @Query('from') from?: string, @Query('to') to?: string,
  ) {
    return this.expensesService.toCsv({ search, category, status, from, to });
  }

  @Post()
  @RequirePermissions('expense.create')
  @ApiOperation({ summary: 'Create an expense' })
  create(@Body() dto: CreateExpenseDto, @CurrentUser() actor: JwtUser) {
    return this.expensesService.create(dto as unknown as ExpenseInput, actor);
  }

  @Get(':id')
  @RequirePermissions('expense.read')
  @ApiOperation({ summary: 'Get an expense' })
  findOne(@Param('id') id: string) {
    return this.expensesService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('expense.update')
  @ApiOperation({ summary: 'Update an expense' })
  update(@Param('id') id: string, @Body() dto: UpdateExpenseDto, @CurrentUser() actor: JwtUser) {
    return this.expensesService.update(id, dto as unknown as Partial<ExpenseInput>, actor);
  }

  @Delete(':id')
  @RequirePermissions('expense.delete')
  @ApiOperation({ summary: 'Delete an expense' })
  remove(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.expensesService.remove(id, actor);
  }
}