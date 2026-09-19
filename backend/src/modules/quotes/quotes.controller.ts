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
import { QuotesService } from './quotes.service';
import { CreateQuoteDto, QuoteStatusDto, UpdateQuoteDto } from './dto/quote.dto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Quotes')
@ApiBearerAuth()
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  @RequirePermissions('quote.read')
  @ApiOperation({ summary: 'List quotes' })
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.quotesService.list({ page: Number(page), limit: Number(limit), search, status, clientId, sort });
  }

  @Get('export')
  @RequirePermissions('quote.read')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="quotes.csv"')
  @ApiOperation({ summary: 'Export quotes as CSV' })
  async export(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('clientId') clientId?: string,
  ) {
    return this.quotesService.toCsv({ search, status, clientId });
  }

  @Post()
  @RequirePermissions('quote.create')
  @ApiOperation({ summary: 'Create a quote' })
  create(@Body() dto: CreateQuoteDto, @CurrentUser() actor: JwtUser) {
    return this.quotesService.create(dto, actor);
  }

  @Get(':id')
  @RequirePermissions('quote.read')
  @ApiOperation({ summary: 'Get a quote' })
  findOne(@Param('id') id: string) {
    return this.quotesService.findById(id);
  }

  @Patch(':id')
  @RequirePermissions('quote.update')
  @ApiOperation({ summary: 'Update a draft quote' })
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto, @CurrentUser() actor: JwtUser) {
    return this.quotesService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions('quote.delete')
  @ApiOperation({ summary: 'Delete a draft quote' })
  remove(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.quotesService.remove(id, actor);
  }

  @Post(':id/status')
  @RequirePermissions('quote.update')
  @ApiOperation({ summary: 'Change quote status (send/accept/reject)' })
  status(@Param('id') id: string, @Body() dto: QuoteStatusDto, @CurrentUser() actor: JwtUser) {
    return this.quotesService.setStatus(id, dto.status, actor);
  }

  @Post(':id/convert')
  @RequirePermissions('invoice.create')
  @ApiOperation({ summary: 'Convert a quote into an invoice' })
  convert(@Param('id') id: string, @CurrentUser() actor: JwtUser) {
    return this.quotesService.convertToInvoice(id, actor);
  }
}