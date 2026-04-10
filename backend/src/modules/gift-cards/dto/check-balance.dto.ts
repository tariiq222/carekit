import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CheckBalanceDto {
  @ApiProperty({ description: 'Gift card code', example: 'GC-ABC123' })
  @IsString()
  @MinLength(1)
  code: string;
}
