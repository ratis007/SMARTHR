import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class PayrollPeriodDto {
  @ApiProperty() @IsNumber()
  month: number;

  @ApiProperty() @IsNumber()
  year: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  companyId?: number;

  @ApiPropertyOptional() @IsOptional() @IsString()
  reason?: string;
}
