import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyId } from '../common/company-id.decorator';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'X-Company-ID', required: false })
@Controller('contracts')
export class ContractsController {
  constructor(private service: ContractsService) {}

  @Get()
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'companyId',  required: false })
  findAll(
    @Query('employeeId') eid?: string,
    @Query('companyId')  qCid?: string,
    @CompanyId() headerCid?: number,
  ) {
    const companyId = qCid ? +qCid : headerCid;
    return this.service.findAll(eid ? +eid : undefined, companyId);
  }

  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(+id); }
  @Post() create(@Body() dto: CreateContractDto) { return this.service.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: CreateContractDto) { return this.service.update(+id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(+id); }
}
