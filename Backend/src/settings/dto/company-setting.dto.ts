import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompanySettingDto {
  @ApiProperty() @IsIn(['department', 'position', 'document_type', 'category', 'status', 'field', 'workflow', 'notification', 'numbering'])
  settingType: string;

  @ApiProperty() @IsString() name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() code?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsObject() config?: any;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isRequired?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CurrencySettingDto {
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['CDF', 'USD']) primaryCurrency?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['CDF', 'USD']) secondaryCurrency?: string;
  @ApiProperty() @IsNumber() usdToCdfRate: number;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['manual', 'api']) rateSource?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['nearest', 'up', 'down']) roundingMode?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() roundingPrecision?: number;
}
