import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { ContractStatus } from './contract.entity';
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
  @ApiQuery({ name: 'companyId', required: false })
  findAll(
    @Query('employeeId') employeeId?: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.findAll(employeeId ? +employeeId : undefined, companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(+id); }

  @Post()
  create(@Body() dto: CreateContractDto) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateContractDto) { return this.service.update(+id, dto); }

  @Patch(':id/toggle-status')
  toggleStatus(@Param('id') id: string) { return this.service.toggleStatus(+id); }

  @Patch(':id/activate')
  activate(@Param('id') id: string) { return this.service.setStatus(+id, ContractStatus.ACTIVE); }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) { return this.service.setStatus(+id, ContractStatus.TERMINATED); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(+id); }
}
