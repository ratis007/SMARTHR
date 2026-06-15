import { IsNumber, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AllowanceDto {
  @ApiProperty() label: string;
  @ApiProperty() @IsNumber() amount: number;
}

export class CreatePayrollDto {
  @ApiProperty() @IsNumber() employeeId: number;
  @ApiProperty() @IsNumber() month: number;
  @ApiProperty() @IsNumber() year: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() baseSalary?: number;
  @ApiPropertyOptional({ type: [AllowanceDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AllowanceDto)
  allowances?: AllowanceDto[];
}
