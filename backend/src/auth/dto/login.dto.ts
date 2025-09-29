import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  /** Email address used to login (must be a valid email) */
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  /** Plain password; validated only for length here, strong policy left to service */
  @ApiProperty({ minLength: 8, example: 'ChangeMe123!' })
  @IsString()
  @MinLength(8)
  password!: string;
}
