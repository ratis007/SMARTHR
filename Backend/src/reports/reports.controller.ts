import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyId } from '../common/company-id.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'X-Company-ID', required: false, description: 'Filtre par entreprise (header)' })
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('dashboard')
  @ApiQuery({ name: 'companyId', required: false })
  getDashboard(
    @Query('companyId') qCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    // Priorité : query param > header X-Company-ID
    const companyId = qCompanyId ? +qCompanyId : headerCompanyId;
    return this.service.getDashboardStats(companyId);
  }

  @Get('payroll')
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'companyId', required: false })
  getPayroll(
    @Query('month') m: string,
    @Query('year') y: string,
    @Query('companyId') qCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = qCompanyId ? +qCompanyId : headerCompanyId;
    return this.service.getPayrollReport(+m, +y, companyId);
  }

  @Get('leave')
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'companyId', required: false })
  getLeave(
    @Query('year') y: string,
    @Query('companyId') qCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = qCompanyId ? +qCompanyId : headerCompanyId;
    return this.service.getLeaveReport(+y, companyId);
  }
}
