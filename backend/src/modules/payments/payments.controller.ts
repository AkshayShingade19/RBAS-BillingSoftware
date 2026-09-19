import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, UpdatePaymentDto } from './dto/payment.dto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @RequirePermissions('payment.read')
  @ApiOperation({ summary: 'List payments' })
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('method') method?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
  ) {
    return this.paymentsService.list({ page: Number(page), limit: Number(limit), search, invoiceId, method, from, to, sort });
  }

  @Get('export')
  @RequirePermissions('payment.read')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="payments.csv"')
  @ApiOperation({ summary: 'Export payments as CSV' })
  async export(
    @Query('search') search?: string,
    @Query('invoiceId') invoiceId?: string,
    @Query('method') method?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.paymentsService.toCsv({ search, invoiceId, method, from, to });
  }

  @Post()
  @RequirePermissions('invoice.update')
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  create(@Body() dto: CreatePaymentDto, @CurrentUser() actor: JwtUser) {
    return this.paymentsService.create(dto, actor);
  }

  @Get(':id')
  @RequirePermissions('payment.read')
  @ApiOperation({ summary: 'Get a payment' })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('payment.update')
  @ApiOperation({ summary: 'Update a payment reference/details' })
  update(@Param('id') id: string, @Body() dto: UpdatePaymentDto, @CurrentUser() actor: JwtUser) {
    return this.paymentsService.update(id, dto, actor);
  }

  @Delete(':id/void')
  @RequirePermissions('payment.update')
  @ApiOperation({ summary: 'Void a payment and reverse the invoice balance' })
  void(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.paymentsService.void(id, actor);
  }
}