import { Controller, Get, Post, Put, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private service: CompaniesService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(+id); }
  @Post() create(@Body() dto: CreateCompanyDto) { return this.service.create(dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: CreateCompanyDto) { return this.service.update(+id, dto); }
  @Patch(':id/toggle-status') toggleStatus(@Param('id') id: string) { return this.service.toggleStatus(+id); }
  @Patch(':id/activate') activate(@Param('id') id: string) { return this.service.setActive(+id, true); }
  @Patch(':id/archive') archive(@Param('id') id: string) { return this.service.archive(+id); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(+id); }
}
