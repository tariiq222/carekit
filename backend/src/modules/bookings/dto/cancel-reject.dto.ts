import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelRejectDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
