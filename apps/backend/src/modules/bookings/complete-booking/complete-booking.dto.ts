import { IsOptional, IsString } from 'class-validator';

export class CompleteBookingDto {
  @IsOptional() @IsString() completionNotes?: string;
}
