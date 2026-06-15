import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { PayrollStatus } from './payroll.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyId } from '../common/company-id.decorator';

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'X-Company-ID', required: false })
@Controller('payroll')
export class PayrollController {
  constructor(private service: PayrollService) {}

  @Get()
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('companyId') queryCompanyId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.findAll(
      month ? +month : undefined,
      year ? +year : undefined,
      page ? +page : 1,
      limit ? +limit : 200,
      companyId,
    );
  }

  @Get('summary')
  @ApiQuery({ name: 'companyId', required: false })
  summary(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.getMonthlySummary(+month, +year, companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(+id); }

  @Post('generate')
  generate(@Body() dto: CreatePayrollDto) { return this.service.generate(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePayrollDto) { return this.service.update(+id, dto); }

  @Put(':id/validate')
  validate(@Param('id') id: string) { return this.service.validate(+id); }

  @Patch(':id/toggle-status')
  toggleStatus(@Param('id') id: string) { return this.service.toggleStatus(+id); }

  @Patch(':id/activate')
  activate(@Param('id') id: string) { return this.service.setStatus(+id, PayrollStatus.DRAFT); }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) { return this.service.setStatus(+id, PayrollStatus.ARCHIVED); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(+id); }
}
