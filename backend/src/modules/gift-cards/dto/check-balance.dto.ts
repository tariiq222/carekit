import { IsString, MinLength } from 'class-validator';

export class CheckBalanceDto {
  @IsString()
  @MinLength(1)
  code: string;
}
