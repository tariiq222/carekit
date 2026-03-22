import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateVacationDto {
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
