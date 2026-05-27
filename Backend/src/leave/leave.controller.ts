import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyId } from '../common/company-id.decorator';

@ApiTags('Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiHeader({ name: 'X-Company-ID', required: false })
@Controller('leave')
export class LeaveController {
  constructor(private service: LeaveService) {}

  @Get()
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'companyId',  required: false })
  @ApiQuery({ name: 'page',       required: false })
  @ApiQuery({ name: 'limit',      required: false })
  findAll(
    @Query('employeeId') eid?: string,
    @Query('companyId')  qCid?: string,
    @Query('page')       page?: string,
    @Query('limit')      limit?: string,
    @CompanyId()         headerCid?: number,
  ) {
    const companyId = qCid ? +qCid : headerCid;
    return this.service.findAll(eid ? +eid : undefined, page ? +page : 1, limit ? +limit : 200, companyId);
  }

  @Get('pending')
  @ApiQuery({ name: 'companyId', required: false })
  getPending(
    @Query('companyId') qCid?: string,
    @CompanyId()        headerCid?: number,
  ) {
    const companyId = qCid ? +qCid : headerCid;
    return this.service.getPending(companyId);
  }

  @Get(':id/stats') getStats(@Param('id') id: string) { return this.service.getStats(+id); }
  @Get(':id')       findOne(@Param('id') id: string)  { return this.service.findOne(+id); }
  @Post()           create(@Body() dto: CreateLeaveDto) { return this.service.create(dto); }
  @Put(':id/approve') approve(@Param('id') id: string, @Request() req) { return this.service.approve(+id, req.user.id); }
  @Put(':id/reject')  reject(@Param('id') id: string)  { return this.service.reject(+id); }
  @Delete(':id')      remove(@Param('id') id: string)  { return this.service.remove(+id); }
}
