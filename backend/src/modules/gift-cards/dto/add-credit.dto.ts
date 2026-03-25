import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class AddCreditDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
