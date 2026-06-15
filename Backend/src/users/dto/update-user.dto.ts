import { IsArray, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ required: false }) @IsOptional() @IsEmail() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() firstName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() lastName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['active', 'inactive', 'suspended']) status?: string;
  @ApiProperty({ required: false, type: [Number] }) @IsOptional() @IsArray() roleIds?: number[];
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() @MinLength(6) password: string;
}
