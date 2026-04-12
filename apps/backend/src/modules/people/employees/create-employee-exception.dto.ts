import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateEmployeeExceptionDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
