import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PayrollVariableInputDto {
  @ApiProperty() @IsString()
  code: string;

  @ApiProperty() @IsString()
  label: string;

  @ApiProperty() @IsNumber()
  amount: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  currency?: 'CDF' | 'USD';
}

export class PayrollPreviewDto {
  @ApiProperty() @IsNumber()
  employeeId: number;

  @ApiProperty() @IsNumber()
  month: number;

  @ApiProperty() @IsNumber()
  year: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  baseSalary?: number;

  @ApiPropertyOptional({ type: [PayrollVariableInputDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PayrollVariableInputDto)
  variables?: PayrollVariableInputDto[];
}

export class CreatePayrollRubricDto {
  @ApiProperty() @IsString()
  code: string;

  @ApiProperty() @IsString()
  label: string;

  @ApiProperty() @IsString()
  category: string;

  @ApiProperty() @IsString()
  calculationType: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  value?: number;

  @ApiPropertyOptional() @IsOptional()
  isTaxable?: boolean;

  @ApiPropertyOptional() @IsOptional()
  isActive?: boolean;
}

export class CreateLegalRateDto {
  @ApiProperty() @IsString()
  contributionCode: string;

  @ApiProperty() @IsString()
  label: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  employeeRate?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  employerRate?: number;

  @ApiProperty() @IsString()
  effectiveFrom: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  effectiveTo?: string;
}

export class CreateIprBracketDto {
  @ApiProperty() @IsNumber()
  minAmount: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  maxAmount?: number;

  @ApiProperty() @IsNumber()
  rate: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  fixedAmount?: number;

  @ApiProperty() @IsString()
  effectiveFrom: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  effectiveTo?: string;
}

export class CreatePayrollVariableDto {
  @ApiProperty() @IsNumber()
  employeeId: number;

  @ApiProperty() @IsNumber()
  month: number;

  @ApiProperty() @IsNumber()
  year: number;

  @ApiProperty() @IsString()
  code: string;

  @ApiProperty() @IsString()
  label: string;

  @ApiProperty() @IsString()
  type: 'allowance' | 'deduction';

  @ApiPropertyOptional() @IsOptional() @IsString()
  category?: string;

  @ApiProperty() @IsNumber()
  amount: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  currency?: 'CDF' | 'USD';

  @ApiPropertyOptional() @IsOptional()
  taxable?: boolean;
}

export class CreatePayrollTimeInputDto {
  @ApiProperty() @IsNumber()
  employeeId: number;

  @ApiProperty() @IsNumber()
  month: number;

  @ApiProperty() @IsNumber()
  year: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  overtimeHours?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  nightHours?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  sundayHours?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  holidayHours?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  unpaidAbsenceDays?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  lateMinutes?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  notes?: string;
}
