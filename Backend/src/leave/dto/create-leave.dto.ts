import { IsNumber, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LeaveType } from '../leave.entity';

export class CreateLeaveDto {
  @ApiProperty() @IsNumber() employeeId: number;
  @ApiProperty({ enum: LeaveType }) @IsEnum(LeaveType) type: LeaveType;
  @ApiProperty({ example: '2026-05-01' }) @IsString() startDate: string;
  @ApiProperty({ example: '2026-05-10' }) @IsString() endDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
