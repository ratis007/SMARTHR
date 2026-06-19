import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class WorkProfileDayDto {
  @ApiProperty() @IsNumber()
  weekday: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isWorkingDay?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsString()
  startTime?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  endTime?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  breakStart?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  breakEnd?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  expectedMinutes?: number;
}

export class CreateWorkProfileDto {
  @ApiProperty() @IsString()
  code: string;

  @ApiProperty() @IsString()
  name: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  profileType?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  weeklyHours?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  graceLateMinutes?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  overtimeThresholdMinutes?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  flexibleArrivalFrom?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  flexibleArrivalTo?: string;

  @ApiPropertyOptional({ type: [WorkProfileDayDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => WorkProfileDayDto)
  days?: WorkProfileDayDto[];
}

export class CreateHolidayDto {
  @ApiProperty() @IsString()
  name: string;

  @ApiProperty() @IsString()
  holidayDate: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isPaid?: boolean;
}

export class CreateTeamDto {
  @ApiProperty() @IsString()
  code: string;

  @ApiProperty() @IsString()
  name: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  rotationPattern?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  siteId?: number;
}

export class CreateRotationPatternDto {
  @ApiProperty() @IsString()
  code: string;

  @ApiProperty() @IsString()
  name: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  rotationType?: string;

  @ApiProperty() @IsNumber()
  workDays: number;

  @ApiProperty() @IsNumber()
  restDays: number;

  @ApiProperty() @IsString()
  cycleStartDate: string;

  @ApiProperty() @IsNumber()
  dayProfileId: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  nightProfileId?: number;
}

export class AssignWorkProfileDto {
  @ApiProperty() @IsNumber()
  profileId: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  employeeId?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  department?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  position?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  teamId?: number;

  @ApiProperty() @IsString()
  effectiveFrom: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  effectiveTo?: string;
}

export class CreateClockEventDto {
  @ApiProperty() @IsNumber()
  employeeId: number;

  @ApiProperty() @IsString()
  eventType: 'entry' | 'exit';

  @ApiPropertyOptional() @IsOptional() @IsString()
  eventTime?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  method?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  terminalId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  locationLabel?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  latitude?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  longitude?: number;
}

export class ImportClockEventItemDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber()
  employeeId?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  matricule?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  externalEmployeeRef?: string;

  @ApiProperty() @IsString()
  eventType: 'entry' | 'exit';

  @ApiProperty() @IsString()
  eventTime: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  method?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  terminalId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  externalReference?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  locationLabel?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  latitude?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  longitude?: number;
}

export class ImportClockEventsDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  source?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  terminalId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  batchReference?: string;

  @ApiProperty({ type: [ImportClockEventItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => ImportClockEventItemDto)
  events: ImportClockEventItemDto[];
}

export class CalculateAttendanceDto {
  @ApiProperty() @IsString()
  dateFrom: string;

  @ApiProperty() @IsString()
  dateTo: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  employeeId?: number;
}

export class GenerateScheduleDto {
  @ApiProperty() @IsString()
  dateFrom: string;

  @ApiProperty() @IsString()
  dateTo: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  rotationPatternId?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  profileId?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  teamId?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional() @IsArray()
  employeeIds?: number[];

  @ApiPropertyOptional() @IsOptional() @IsString()
  department?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  overwrite?: boolean;
}

export class UpdateScheduleEntryDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber()
  employeeId?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  workDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  profileId?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  teamId?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  shiftLabel?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  plannedStart?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  plannedEnd?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  recalculate?: boolean;
}

export class DetectAttendanceAlertsDto {
  @ApiProperty() @IsString()
  dateFrom: string;

  @ApiProperty() @IsString()
  dateTo: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray()
  alertTypes?: string[];
}

export class UpdateAttendanceAlertDto {
  @ApiPropertyOptional() @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  note?: string;
}

export class DispatchNotificationsDto {
  @ApiPropertyOptional() @IsOptional() @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray()
  channels?: string[];

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  simulateProviders?: boolean;
}

export class ExportAttendanceToPayrollDto {
  @ApiProperty() @IsNumber()
  month: number;

  @ApiProperty() @IsNumber()
  year: number;
}
