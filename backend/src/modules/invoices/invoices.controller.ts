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
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  VoidInvoiceDto,
} from './dto/invoice.dto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @RequirePermissions('invoice.read')
  @ApiOperation({ summary: 'List invoices' })
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('sort') sort?: string,
  ) {
    return this.invoicesService.list({
      page: Number(page), limit: Number(limit), search, status, clientId, from, to, sort,
    });
  }

  @Get('export')
  @RequirePermissions('invoice.read')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="invoices.csv"')
  @ApiOperation({ summary: 'Export invoices as CSV' })
  async export(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.invoicesService.toCsv({ search, status, clientId, from, to });
  }

  @Post()
  @RequirePermissions('invoice.create')
  @ApiOperation({ summary: 'Create an invoice' })
  create(@Body() dto: CreateInvoiceDto, @CurrentUser() actor: JwtUser) {
    return this.invoicesService.create(dto, actor);
  }

  @Get(':id')
  @RequirePermissions('invoice.read')
  @ApiOperation({ summary: 'Get an invoice' })
  findOne(@Param('id') id: string) {
    return this.invoicesService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('invoice.update')
  @ApiOperation({ summary: 'Update a draft invoice' })
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto, @CurrentUser() actor: JwtUser) {
    return this.invoicesService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('invoice.delete')
  @ApiOperation({ summary: 'Delete a draft invoice' })
  remove(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.invoicesService.remove(id, actor);
  }

  @Post(':id/send')
  @RequirePermissions('invoice.update')
  @ApiOperation({ summary: 'Send an invoice (draft to sent)' })
  send(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.invoicesService.send(id, actor);
  }

  @Post(':id/mark-paid')
  @RequirePermissions('invoice.update')
  @ApiOperation({ summary: 'Mark an invoice as paid' })
  markPaid(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.invoicesService.markPaid(id, actor);
  }

  @Post(':id/void')
  @RequirePermissions('invoice.update')
  @ApiOperation({ summary: 'Void an invoice' })
  void(@Param('id') id: string, @Body() dto: VoidInvoiceDto, @CurrentUser() actor: JwtUser) {
    return this.invoicesService.void(id, actor, dto.reason);
  }
}