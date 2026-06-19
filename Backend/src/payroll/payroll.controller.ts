import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, Req, Res, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PayrollService } from './payroll.service';
import { CreatePayrollDto } from './dto/create-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { PayrollStatus } from './payroll.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyId } from '../common/company-id.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireAnyPermissions, RequirePermissions } from '../auth/permissions.decorator';
import { CreateIprBracketDto, CreateLegalRateDto, CreatePayrollRubricDto, CreatePayrollTimeInputDto, CreatePayrollVariableDto, PayrollPreviewDto } from './dto/payroll-engine.dto';
import { GeneratePayrollBatchDto } from './dto/payroll-batch.dto';
import { Response } from 'express';
import { PayrollPeriodDto } from './dto/payroll-period.dto';

const payrollCsvUpload = {
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'application/octet-stream',
    ];
    const nameOk = /\.(csv|txt|xlsx)$/i.test(file.originalname || '');
    cb(null, allowed.includes(file.mimetype) || nameOk);
  },
};

@ApiTags('Payroll')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiHeader({ name: 'X-Company-ID', required: false })
@Controller('payroll')
export class PayrollController {
  constructor(private service: PayrollService) {}

  @Get()
  @RequirePermissions('payroll:read')
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
  @RequirePermissions('payroll:read')
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

  @Get('period/status')
  @RequirePermissions('payroll:read')
  periodStatus(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.getPeriod({ companyId, month: +month, year: +year });
  }

  @Post('period/close')
  @RequireAnyPermissions('payroll:close', 'payroll:write')
  closePeriod(
    @Body() dto: PayrollPeriodDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = dto.companyId || (queryCompanyId ? +queryCompanyId : headerCompanyId);
    return this.service.closePeriod({ ...dto, companyId }, req.user, req.ip);
  }

  @Post('period/reopen')
  @RequireAnyPermissions('payroll:close', 'payroll:write')
  reopenPeriod(
    @Body() dto: PayrollPeriodDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = dto.companyId || (queryCompanyId ? +queryCompanyId : headerCompanyId);
    return this.service.reopenPeriod({ ...dto, companyId }, req.user, req.ip);
  }

  @Get('engine/configuration')
  @RequirePermissions('payroll:read')
  getConfiguration(
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.getConfiguration(companyId);
  }

  @Post('engine/preview')
  @RequirePermissions('payroll:read')
  preview(@Body() dto: PayrollPreviewDto) {
    return this.service.preview(dto);
  }

  @Post('engine/rubrics')
  @RequireAnyPermissions('payroll:configure', 'payroll:write')
  createRubric(
    @Body() dto: CreatePayrollRubricDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.createRubric(companyId || null, dto, req.user?.id, req.ip);
  }

  @Post('engine/legal-rates')
  @RequireAnyPermissions('payroll:configure', 'payroll:write')
  createLegalRate(
    @Body() dto: CreateLegalRateDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.createLegalRate(companyId || null, dto, req.user?.id, req.ip);
  }

  @Post('engine/ipr-brackets')
  @RequireAnyPermissions('payroll:configure', 'payroll:write')
  createIprBracket(
    @Body() dto: CreateIprBracketDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.createIprBracket(companyId || null, dto, req.user?.id, req.ip);
  }

  @Get('variables')
  @RequirePermissions('payroll:read')
  listVariables(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('employeeId') employeeId?: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.listVariables(
      companyId || null,
      month ? +month : undefined,
      year ? +year : undefined,
      employeeId ? +employeeId : undefined,
    );
  }

  @Post('variables')
  @RequireAnyPermissions('payroll:input', 'payroll:write')
  createVariable(
    @Body() dto: CreatePayrollVariableDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.createVariable(companyId || null, dto, req.user?.id, req.ip);
  }

  @Post('variables/import-csv')
  @RequireAnyPermissions('payroll:import', 'payroll:input', 'payroll:write')
  @UseInterceptors(FileInterceptor('file', payrollCsvUpload))
  importVariablesCsv(
    @UploadedFile() file: any,
    @Req() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    if (!file?.buffer) throw new BadRequestException('Fichier CSV requis');
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.importVariablesCsv(companyId || null, +month, +year, file.buffer, req.user?.id, req.ip);
  }

  @Get('time-inputs')
  @RequirePermissions('payroll:read')
  listTimeInputs(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('employeeId') employeeId?: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.listTimeInputs(
      companyId || null,
      month ? +month : undefined,
      year ? +year : undefined,
      employeeId ? +employeeId : undefined,
    );
  }

  @Post('time-inputs')
  @RequireAnyPermissions('payroll:input', 'payroll:write')
  createTimeInput(
    @Body() dto: CreatePayrollTimeInputDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.createTimeInput(companyId || null, dto, req.user?.id, req.ip);
  }

  @Post('time-inputs/import-csv')
  @RequireAnyPermissions('payroll:import', 'payroll:input', 'payroll:write')
  @UseInterceptors(FileInterceptor('file', payrollCsvUpload))
  importTimeInputsCsv(
    @UploadedFile() file: any,
    @Req() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    if (!file?.buffer) throw new BadRequestException('Fichier CSV requis');
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.importTimeInputsCsv(companyId || null, +month, +year, file.buffer, req.user?.id, req.ip);
  }

  @Post('time-inputs/import-excel')
  @RequireAnyPermissions('payroll:import', 'payroll:input', 'payroll:write')
  @UseInterceptors(FileInterceptor('file', payrollCsvUpload))
  importTimeInputsExcel(
    @UploadedFile() file: any,
    @Req() req: any,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    if (!file?.buffer) throw new BadRequestException('Fichier Excel requis');
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.importTimeInputsExcel(companyId || null, +month, +year, file.buffer, req.user?.id, req.ip);
  }

  @Post('generate')
  @RequireAnyPermissions('payroll:generate', 'payroll:write')
  generate(@Body() dto: CreatePayrollDto, @Req() req: any) { return this.service.generate(dto, req.user, req.ip); }

  @Post('generate-batch')
  @RequireAnyPermissions('payroll:generate', 'payroll:write')
  generateBatch(
    @Body() dto: GeneratePayrollBatchDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = dto.companyId || (queryCompanyId ? +queryCompanyId : headerCompanyId);
    return this.service.startBatchGeneration({ ...dto, companyId }, req.user, req.ip);
  }

  @Get('jobs/:id')
  @RequirePermissions('payroll:read')
  getBatchJob(@Param('id') id: string) {
    return this.service.getBatchJob(+id);
  }

  @Get('journal/export')
  @RequireAnyPermissions('payroll:export', 'payroll:read')
  async exportJournal(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('companyId') queryCompanyId: string,
    @CompanyId() headerCompanyId: number,
    @Res() res: Response,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    const csv = await this.service.generatePayrollJournalCsv(+month, +year, companyId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="journal-paie-${month}-${year}.csv"`);
    res.send(`\uFEFF${csv}`);
  }

  @Get('journal/export-excel')
  @RequireAnyPermissions('payroll:export', 'payroll:read')
  async exportJournalExcel(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('companyId') queryCompanyId: string,
    @CompanyId() headerCompanyId: number,
    @Res() res: Response,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    const xml = await this.service.generatePayrollJournalExcel(+month, +year, companyId);
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="journal-paie-${month}-${year}.xls"`);
    res.send(xml);
  }

  @Get('journal/export-xlsx')
  @RequireAnyPermissions('payroll:export', 'payroll:read')
  async exportJournalXlsx(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('companyId') queryCompanyId: string,
    @CompanyId() headerCompanyId: number,
    @Res() res: Response,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    const buffer = await this.service.generatePayrollJournalXlsx(+month, +year, companyId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="journal-paie-${month}-${year}.xlsx"`);
    res.send(buffer);
  }

  @Get('book/export-excel')
  @RequireAnyPermissions('payroll:export', 'payroll:read')
  async exportPayrollBookExcel(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('companyId') queryCompanyId: string,
    @CompanyId() headerCompanyId: number,
    @Res() res: Response,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    const xml = await this.service.generatePayrollBookExcel(+month, +year, companyId);
    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="livre-paie-${month}-${year}.xls"`);
    res.send(xml);
  }

  @Get('book/export-xlsx')
  @RequireAnyPermissions('payroll:export', 'payroll:read')
  async exportPayrollBookXlsx(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('companyId') queryCompanyId: string,
    @CompanyId() headerCompanyId: number,
    @Res() res: Response,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    const buffer = await this.service.generatePayrollBookXlsx(+month, +year, companyId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="livre-paie-${month}-${year}.xlsx"`);
    res.send(buffer);
  }

  @Get('audit-trail')
  @RequirePermissions('payroll:read')
  auditTrail(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.getAuditTrail(+month, +year, companyId);
  }

  @Post('jobs/:id/cancel')
  @RequireAnyPermissions('payroll:generate', 'payroll:write')
  cancelBatchJob(@Param('id') id: string, @Req() req: any) {
    return this.service.cancelBatchJob(+id, req.user, req.ip);
  }

  @Get(':id')
  @RequirePermissions('payroll:read')
  findOne(@Param('id') id: string) { return this.service.findOne(+id); }

  @Get(':id/payslip')
  @RequireAnyPermissions('payroll:export', 'payroll:read')
  async payslip(@Param('id') id: string, @Res() res: Response) {
    const html = await this.service.generatePayslipHtml(+id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get(':id/payslip-excel')
  @RequireAnyPermissions('payroll:export', 'payroll:read')
  async payslipExcel(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.service.generatePayslipExcel(+id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="bulletin-paie-${id}.xlsx"`);
    res.send(buffer);
  }

  @Post(':id/archive-payslip')
  @RequireAnyPermissions('payroll:validate', 'payroll:export', 'payroll:write')
  archivePayslip(@Param('id') id: string, @Req() req: any) {
    return this.service.archivePayslip(+id, req.user, req.ip);
  }

  @Get(':id/documents')
  @RequireAnyPermissions('payroll:export', 'payroll:read')
  listPayrollDocuments(@Param('id') id: string) {
    return this.service.listPayrollDocuments(+id);
  }

  @Get(':id/documents/:documentId/download')
  @RequireAnyPermissions('payroll:export', 'payroll:read')
  async downloadPayrollDocument(
    @Param('id') id: string,
    @Param('documentId') documentId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { document, absolutePath } = await this.service.downloadPayrollDocument(+id, +documentId, req.user, req.ip);
    res.download(absolutePath, document.fileName);
  }

  @Put(':id')
  @RequireAnyPermissions('payroll:update', 'payroll:write')
  update(@Param('id') id: string, @Body() dto: UpdatePayrollDto, @Req() req: any) {
    return this.service.update(+id, dto, req.user, req.ip);
  }

  @Put(':id/validate')
  @RequireAnyPermissions('payroll:validate', 'payroll:write')
  validate(@Param('id') id: string, @Req() req: any) { return this.service.validate(+id, req.user, req.ip); }

  @Put(':id/workflow/:status')
  @RequireAnyPermissions('payroll:validate', 'payroll:write')
  workflow(@Param('id') id: string, @Param('status') status: PayrollStatus, @Req() req: any) {
    return this.service.advanceWorkflow(+id, status, req.user, req.ip);
  }

  @Patch(':id/toggle-status')
  @RequireAnyPermissions('payroll:update', 'payroll:write')
  toggleStatus(@Param('id') id: string, @Req() req: any) { return this.service.toggleStatus(+id, req.user, req.ip); }

  @Patch(':id/activate')
  @RequireAnyPermissions('payroll:update', 'payroll:write')
  activate(@Param('id') id: string, @Req() req: any) { return this.service.setStatus(+id, PayrollStatus.DRAFT, req.user, req.ip); }

  @Patch(':id/deactivate')
  @RequireAnyPermissions('payroll:update', 'payroll:write')
  deactivate(@Param('id') id: string, @Req() req: any) { return this.service.setStatus(+id, PayrollStatus.ARCHIVED, req.user, req.ip); }

  @Delete(':id')
  @RequireAnyPermissions('payroll:update', 'payroll:write')
  remove(@Param('id') id: string, @Req() req: any) { return this.service.remove(+id, req.user, req.ip); }
}
