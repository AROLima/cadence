import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ example: 'Let us sync before Friday.' })
  @IsString()
  @MinLength(1)
  text!: string;
}
