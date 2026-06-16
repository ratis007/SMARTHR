import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional } from 'class-validator';

export class GeneratePayrollBatchDto {
  @ApiProperty() @IsNumber()
  month: number;

  @ApiProperty() @IsNumber()
  year: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  companyId?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional() @IsArray()
  employeeIds?: number[];
}
