import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequireAnyPermissions, RequirePermissions } from '../auth/permissions.decorator';
import { CompanyId } from '../common/company-id.decorator';
import {
  AssignWorkProfileDto,
  CalculateAttendanceDto,
  CreateClockEventDto,
  CreateHolidayDto,
  CreateRotationPatternDto,
  CreateTeamDto,
  CreateWorkProfileDto,
  DetectAttendanceAlertsDto,
  DispatchNotificationsDto,
  ExportAttendanceToPayrollDto,
  GenerateScheduleDto,
  ImportClockEventsDto,
  UpdateAttendanceAlertDto,
  UpdateScheduleEntryDto,
} from './dto/time-attendance.dto';
import { TimeAttendanceService } from './time-attendance.service';

@ApiTags('Time Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiHeader({ name: 'X-Company-ID', required: false })
@Controller('time-attendance')
export class TimeAttendanceController {
  constructor(private service: TimeAttendanceService) {}

  @Get('configuration')
  @RequirePermissions('time:read')
  configuration(@Query('companyId') queryCompanyId?: string, @CompanyId() headerCompanyId?: number) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.getConfiguration(companyId);
  }

  @Post('work-profiles')
  @RequireAnyPermissions('time:configure', 'time:write')
  createWorkProfile(
    @Body() dto: CreateWorkProfileDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.createWorkProfile(companyId, dto, req.user, req.ip);
  }

  @Post('holidays')
  @RequireAnyPermissions('time:configure', 'time:write')
  createHoliday(
    @Body() dto: CreateHolidayDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.createHoliday(companyId, dto, req.user, req.ip);
  }

  @Post('teams')
  @RequireAnyPermissions('time:configure', 'time:write')
  createTeam(
    @Body() dto: CreateTeamDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.createTeam(companyId, dto, req.user, req.ip);
  }

  @Post('rotations')
  @RequireAnyPermissions('time:configure', 'time:write')
  createRotation(
    @Body() dto: CreateRotationPatternDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.createRotationPattern(companyId, dto, req.user, req.ip);
  }

  @Post('assignments')
  @RequireAnyPermissions('time:configure', 'time:write')
  assignWorkProfile(
    @Body() dto: AssignWorkProfileDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.assignWorkProfile(companyId, dto, req.user, req.ip);
  }

  @Post('clock-events')
  @RequireAnyPermissions('time:input', 'time:write')
  createClockEvent(
    @Body() dto: CreateClockEventDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.createClockEvent(companyId, dto, req.user, req.ip);
  }

  @Post('clock-events/import')
  @RequireAnyPermissions('time:import', 'time:input', 'time:write')
  importClockEvents(
    @Body() dto: ImportClockEventsDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.importClockEvents(companyId, dto, req.user, req.ip);
  }

  @Post('days/calculate')
  @RequireAnyPermissions('time:calculate', 'time:write')
  calculate(
    @Body() dto: CalculateAttendanceDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.calculateAttendance(companyId, dto, req.user, req.ip);
  }

  @Post('days/calculate/async')
  @RequireAnyPermissions('time:calculate', 'time:write')
  calculateAsync(
    @Body() dto: CalculateAttendanceDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.startCalculateJob(companyId, dto, req.user, req.ip);
  }

  @Get('days')
  @RequirePermissions('time:read')
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'employeeId', required: false })
  listDays(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('employeeId') employeeId?: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.listAttendanceDays(companyId, dateFrom, dateTo, employeeId ? +employeeId : undefined);
  }

  @Post('schedule/generate')
  @RequireAnyPermissions('time:configure', 'time:write')
  generateSchedule(
    @Body() dto: GenerateScheduleDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.generateSchedule(companyId, dto, req.user, req.ip);
  }

  @Get('schedule')
  @RequirePermissions('time:read')
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'employeeId', required: false })
  @ApiQuery({ name: 'teamId', required: false })
  listSchedule(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('employeeId') employeeId?: string,
    @Query('teamId') teamId?: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.listSchedule(companyId, dateFrom, dateTo, employeeId ? +employeeId : undefined, teamId ? +teamId : undefined);
  }

  @Post('schedule/:id')
  @RequireAnyPermissions('time:configure', 'time:write')
  updateScheduleEntry(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleEntryDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.updateScheduleEntry(companyId, +id, dto, req.user, req.ip);
  }

  @Post('alerts/detect')
  @RequireAnyPermissions('time:calculate', 'time:write')
  detectAlerts(
    @Body() dto: DetectAttendanceAlertsDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.detectAlerts(companyId, dto, req.user, req.ip);
  }

  @Post('alerts/detect/async')
  @RequireAnyPermissions('time:calculate', 'time:write')
  detectAlertsAsync(
    @Body() dto: DetectAttendanceAlertsDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.startDetectAlertsJob(companyId, dto, req.user, req.ip);
  }

  @Get('alerts')
  @RequirePermissions('time:read')
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'alertType', required: false })
  @ApiQuery({ name: 'employeeId', required: false })
  listAlerts(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('alertType') alertType?: string,
    @Query('employeeId') employeeId?: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.listAlerts(companyId, dateFrom, dateTo, status, alertType, employeeId ? +employeeId : undefined);
  }

  @Post('alerts/:id/status')
  @RequireAnyPermissions('time:validate', 'time:write')
  updateAlert(
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceAlertDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.updateAlert(companyId, +id, dto, req.user, req.ip);
  }

  @Get('notifications/outbox')
  @RequirePermissions('time:read')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'channel', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listNotificationOutbox(
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('limit') limit?: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.listNotificationOutbox(companyId, status, channel, limit ? +limit : undefined);
  }

  @Post('notifications/dispatch')
  @RequireAnyPermissions('time:validate', 'time:write')
  dispatchNotifications(
    @Body() dto: DispatchNotificationsDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.dispatchNotifications(companyId, dto, req.user, req.ip);
  }

  @Post('notifications/dispatch/async')
  @RequireAnyPermissions('time:validate', 'time:write')
  dispatchNotificationsAsync(
    @Body() dto: DispatchNotificationsDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.startDispatchNotificationsJob(companyId, dto, req.user, req.ip);
  }

  @Get('jobs')
  @RequirePermissions('time:read')
  listJobs(
    @Query('limit') limit?: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.listProcessingJobs(companyId, limit ? +limit : undefined);
  }

  @Get('jobs/:id')
  @RequirePermissions('time:read')
  getJob(
    @Param('id') id: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.getProcessingJob(companyId, +id);
  }

  @Post('jobs/:id/cancel')
  @RequireAnyPermissions('time:calculate', 'time:write')
  cancelJob(
    @Param('id') id: string,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.cancelProcessingJob(companyId, +id, req.user, req.ip);
  }

  @Post('notifications/:id/retry')
  @RequireAnyPermissions('time:validate', 'time:write')
  retryNotification(
    @Param('id') id: string,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.retryNotification(companyId, +id, req.user, req.ip);
  }

  @Post('days/:id/workflow/:status')
  @RequireAnyPermissions('time:validate', 'time:write')
  workflow(
    @Param('id') id: string,
    @Param('status') status: string,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.advanceWorkflow(companyId, +id, status, req.user, req.ip);
  }

  @Post('payroll/export')
  @RequireAnyPermissions('time:export', 'payroll:input', 'payroll:write')
  exportPayroll(
    @Body() dto: ExportAttendanceToPayrollDto,
    @Req() req: any,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.exportToPayroll(companyId, dto, req.user, req.ip);
  }

  @Get('dashboard')
  @RequirePermissions('time:read')
  dashboard(
    @Query('date') date?: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.dashboard(companyId, date);
  }

  @Get('analytics')
  @RequirePermissions('time:read')
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  analytics(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('companyId') queryCompanyId?: string,
    @CompanyId() headerCompanyId?: number,
  ) {
    const companyId = queryCompanyId ? +queryCompanyId : headerCompanyId;
    return this.service.analytics(companyId, dateFrom, dateTo);
  }
}
