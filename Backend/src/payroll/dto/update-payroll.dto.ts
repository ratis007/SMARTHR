import { IsArray, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CreatePayrollDto } from './create-payroll.dto';

class UpdateAllowanceDto {
  @ApiProperty()
  label: string;

  @ApiProperty()
  @IsNumber()
  amount: number;
}

export class UpdatePayrollDto extends PartialType(CreatePayrollDto) {
  @ApiPropertyOptional({ type: [UpdateAllowanceDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAllowanceDto)
  allowances?: UpdateAllowanceDto[];
}
