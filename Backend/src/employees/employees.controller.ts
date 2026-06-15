import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Employees')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('employees')
export class EmployeesController {
  constructor(private service: EmployeesService) {}

  @Get()
  @ApiQuery({ name: 'companyId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Query('companyId') companyId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(
      companyId ? +companyId : undefined,
      page ? +page : 1,
      limit ? +limit : 1000,
      search,
    );
  }

  @Get('stats')
  getStats() { return this.service.getStats(); }

  @Get(':id/dossier')
  getDossier(@Param('id') id: string) { return this.service.getDossier(+id); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.service.findOne(+id); }

  @Post()
  create(@Body() dto: CreateEmployeeDto) { return this.service.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto) { return this.service.update(+id, dto); }

  @Patch(':id/toggle-status')
  toggleStatus(@Param('id') id: string) { return this.service.toggleStatus(+id); }

  @Patch(':id/activate')
  activate(@Param('id') id: string) { return this.service.setStatus(+id, 'active' as any); }

  @Patch(':id/deactivate')
  deactivate(@Param('id') id: string) { return this.service.setStatus(+id, 'inactive' as any); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.service.remove(+id); }
}
