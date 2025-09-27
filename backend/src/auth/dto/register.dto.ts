import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'new.user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'StrongPassword1!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'New User', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}
