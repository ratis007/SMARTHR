import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
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
  @ApiQuery({ name: 'month',     required: false })
  @ApiQuery({ name: 'year',      required: false })
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'page',      required: false })
  @ApiQuery({ name: 'limit',     required: false })
  findAll(
    @Query('month')     m?: string,
    @Query('year')      y?: string,
    @Query('companyId') qCid?: string,
    @Query('page')      page?: string,
    @Query('limit')     limit?: string,
    @CompanyId()        headerCid?: number,
  ) {
    const companyId = qCid ? +qCid : headerCid;
    return this.service.findAll(
      m ? +m : undefined,
      y ? +y : undefined,
      page ? +page : 1,
      limit ? +limit : 200,
      companyId,
    );
  }

  @Get('summary')
  @ApiQuery({ name: 'companyId', required: false })
  summary(
    @Query('month')     m: string,
    @Query('year')      y: string,
    @Query('companyId') qCid?: string,
    @CompanyId()        headerCid?: number,
  ) {
    const companyId = qCid ? +qCid : headerCid;
    return this.service.getMonthlySummary(+m, +y, companyId);
  }

  @Get(':id')    findOne(@Param('id') id: string) { return this.service.findOne(+id); }
  @Post('generate') generate(@Body() dto: CreatePayrollDto) { return this.service.generate(dto); }
  @Put(':id/validate') validate(@Param('id') id: string) { return this.service.validate(+id); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(+id); }
}
