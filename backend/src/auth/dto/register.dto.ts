import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  /** New account email; must be unique */
  @ApiProperty({ example: 'new.user@example.com' })
  @IsEmail()
  email!: string;

  /** Initial password for the account; service will hash before storing */
  @ApiProperty({ example: 'StrongPassword1!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  /** Optional display name for the user */
  @ApiProperty({ example: 'New User', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}
