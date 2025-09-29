import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min, IsNumber } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';

export class UpdateTransactionDto extends PartialType(CreateTransactionDto) {
  /** Optional new amount; undefined means keep current */
  @ApiPropertyOptional({ example: 300.25 })
  @IsOptional()
  @Transform(({ value }): number | undefined => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    return Number(value);
  })
  @IsNumber()
  amount?: number;

  /** Optional new target account for transfers */
  @ApiPropertyOptional({
    example: 2,
    description: 'Target account for transfers',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  targetAccountId?: number;
}
