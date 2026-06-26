import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateAdminSetupDto {
  @ApiProperty({
    example: 'render-secret-token',
    description: 'Secret token matching ADMIN_SETUP_TOKEN.',
  })
  @IsString()
  @IsNotEmpty()
  setupToken: string;

  @ApiProperty({ example: 'Marie' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName: string;

  @ApiProperty({ example: 'Admin' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName: string;

  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    example: 'Str0ng!Password',
    minLength: 8,
    description: 'Must include uppercase, lowercase, number, and special character.',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/, {
    message: 'password must include uppercase, lowercase, number, and special character',
  })
  password: string;
}
