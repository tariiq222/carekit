import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CompleteBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  completionNotes?: string;
}
