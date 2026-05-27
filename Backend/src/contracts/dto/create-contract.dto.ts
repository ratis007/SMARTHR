import { IsNumber, IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractType } from '../contract.entity';

export class CreateContractDto {
  @ApiProperty() @IsNumber() employeeId: number;
  @ApiProperty({ enum: ContractType }) @IsEnum(ContractType) type: ContractType;
  @ApiProperty() @IsString() startDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endDate?: string;
  @ApiProperty() @IsNumber() salary: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
