import { IsString, IsOptional, IsEmail } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class CreateCompanyDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @Transform(emptyToUndefined) @IsOptional() @IsString() rccm?: string;
  @ApiPropertyOptional() @Transform(emptyToUndefined) @IsOptional() @IsString() idNat?: string;
  @ApiPropertyOptional() @Transform(emptyToUndefined) @IsOptional() @IsString() taxNumber?: string;
  @ApiPropertyOptional() @Transform(emptyToUndefined) @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @Transform(emptyToUndefined) @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @Transform(emptyToUndefined) @IsOptional() @IsEmail() email?: string;
}
