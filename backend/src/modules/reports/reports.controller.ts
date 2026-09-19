import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('revenue')
  @RequirePermissions('report.read')
  @ApiOperation({ summary: 'Revenue report (payments received, invoiced, expenses)' })
  revenue(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.revenue({ from, to });
  }

  @Get('invoice-status')
  @RequirePermissions('report.read')
  @ApiOperation({ summary: 'Invoice status breakdown' })
  invoiceStatus(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.invoiceStatus({ from, to });
  }

  @Get('top-clients')
  @RequirePermissions('report.read')
  @ApiOperation({ summary: 'Top clients by invoiced amount' })
  topClients(@Query('from') from?: string, @Query('to') to?: string, @Query('limit') limit?: string) {
    return this.reportsService.topClients({ from, to, limit });
  }

  @Get('overdue-aging')
  @RequirePermissions('report.read')
  @ApiOperation({ summary: 'Overdue invoice aging buckets' })
  overdueAging(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.overdueAging({ from, to });
  }

  @Get('tax-summary')
  @RequirePermissions('report.read')
  @ApiOperation({ summary: 'Tax collected summary' })
  taxSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.taxSummary({ from, to });
  }

  @Get('dashboard')
  @RequirePermissions('report.read')
  @ApiOperation({ summary: 'Dashboard aggregate metrics' })
  dashboard() {
    return this.reportsService.dashboard();
  }

  @Get('export/:section')
  @RequirePermissions('report.read')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="report.csv"')
  @ApiOperation({ summary: 'Export a report section as CSV' })
  export(
    @Param('section')
    section: 'revenue' | 'invoice-status' | 'top-clients' | 'overdue-aging' | 'tax-summary',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.toCsv(section, { from, to, limit });
  }
}